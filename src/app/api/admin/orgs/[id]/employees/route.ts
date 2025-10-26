// src/app/api/admin/orgs/[id]/employees/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../../../lib/prisma"; // adjust path if your prisma client lives elsewhere

// small helper to return consistent JSON responses
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

// allowed role strings (must match your Prisma enum)
const ALLOWED_ROLES = ["ADMIN", "ORG_ADMIN", "LEARNER"] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

/**
 * GET - list employees for an org (DB-backed)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const params = await (ctx.params as Promise<{ id?: string }> | { id?: string });
    const orgId = params?.id;
    if (!orgId) return json({ error: "org id required" }, 400);

    // Basic connectivity check (non-destructive)
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (cErr: any) {
      console.error("[GET /orgs/:id/employees] prisma connect failed:", cErr?.message ?? cErr);
      return json({ error: "prisma_connect_failed", message: String(cErr?.message ?? cErr) }, 500);
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return json({ error: "organization_not_found" }, 404);

    const users = await prisma.user.findMany({
      where: { orgId: orgId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return json({ success: true, org: { id: orgId, name: org.name }, employees: users }, 200);
  } catch (err: any) {
    console.error("orgs/[id]/employees GET error:", err);
    return json({ error: "failed", message: String(err?.message ?? err) }, 500);
  }
}

/**
 * POST - add an employee to the org (DB-backed)
 * Body: { name, email, role? }
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const params = await (ctx.params as Promise<{ id?: string }> | { id?: string });
    const orgId = params?.id;
    if (!orgId) return json({ error: "org id required in path" }, 400);

    // DEBUG logs (remove in production)
    console.log("[admin/orgs/:id/employees] NODE_ENV:", process.env.NODE_ENV);
    console.log("[admin/orgs/:id/employees] DATABASE_URL present?", !!process.env.DATABASE_URL);

    // quick connectivity test (non-destructive)
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("[admin/orgs/:id/employees] prisma connectivity OK");
    } catch (cErr: any) {
      console.error("[admin/orgs/:id/employees] prisma connectivity failed:", cErr?.message ?? cErr);
      return json({ error: "prisma_connect_failed", message: String(cErr?.message ?? cErr) }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").toString().trim();
    const emailRaw = body?.email ? String(body.email).trim() : "";
    const roleRaw = body?.role ? String(body.role).trim() : undefined;

    if (!name || !emailRaw) return json({ error: "name and email required" }, 400);
    const email = emailRaw.toLowerCase();

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return json({ error: "organization_not_found" }, 404);

    // Validate role if provided
    let roleToSet: AllowedRole | undefined = undefined;
    if (roleRaw) {
      const roleUpper = roleRaw.toUpperCase();
      if (!ALLOWED_ROLES.includes(roleUpper as AllowedRole)) {
        return json({ error: "invalid_role", message: `role must be one of: ${ALLOWED_ROLES.join(", ")}` }, 400);
      }
      roleToSet = roleUpper as AllowedRole;
    }

    // Create the user directly; handle unique-constraint race via catch
    const createData: any = { email, name, orgId };
    if (roleToSet) createData.role = roleToSet;

    try {
      const user = await prisma.user.create({
        data: createData,
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });
      return json({ success: true, employee: user }, 201);
    } catch (createErr: any) {
      console.error("[admin/orgs/:id/employees] create error:", createErr);

      // Prisma unique constraint code: P2002
      if (createErr?.code === "P2002" || (createErr?.meta && Array.isArray(createErr.meta.target) && createErr.meta.target.includes("email"))) {
        // Race / duplicate email. Respond with helpful 409.
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          if (existing.orgId === orgId) {
            return json({ error: "user_already_in_org", user: { id: existing.id, email, orgId } }, 409);
          }
          return json({
            error: "email_exists",
            message:
              "A user with this email already exists in another organization. To allow same email across orgs change schema or handle invites.",
          }, 409);
        }
        return json({ error: "create_failed", message: "unique_constraint" }, 409);
      }

      return json({ error: "create_failed", message: String(createErr?.message ?? createErr) }, 500);
    }
  } catch (err: any) {
    console.error("orgs/[id]/employees POST error (outer):", err);
    return json({ error: "create_failed", message: String(err?.message ?? err) }, 500);
  }
}

/**
 * DELETE - delete an employee by email scoped to org
 * Query param: ?email=someone@example.com
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: { id?: string } | Promise<{ id?: string }> }
) {
  try {
    const params = await (ctx.params as Promise<{ id?: string }> | { id?: string });
    const orgId = params?.id;
    if (!orgId) return json({ error: "org id required in path" }, 400);

    const url = new URL(req.url);
    const emailRaw = url.searchParams.get("email");
    if (!emailRaw) return json({ error: "email required" }, 400);
    const email = emailRaw.toLowerCase();

    // connectivity sanity-check
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (cErr: any) {
      console.error("[DELETE /orgs/:id/employees] prisma connect failed:", cErr?.message ?? cErr);
      return json({ error: "prisma_connect_failed", message: String(cErr?.message ?? cErr) }, 500);
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) return json({ error: "organization_not_found" }, 404);

    const res = await prisma.user.deleteMany({ where: { email, orgId } });

    if (res.count === 0) {
      return json({ error: "not_found" }, 404);
    }

    return json({ success: true, deleted: res.count }, 200);
  } catch (err: any) {
    console.error("orgs/[id]/employees DELETE error:", err);
    return json({ error: "delete_failed", message: String(err?.message ?? err) }, 500);
  }
}
