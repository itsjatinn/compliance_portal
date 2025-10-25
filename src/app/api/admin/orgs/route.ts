// app/api/admin/orgs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

declare global {
  // avoid multiple clients in dev
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export const runtime = "nodejs";

export async function GET() {
  try {
    // select only fields that are guaranteed by the schema (id, name, slug, createdAt)
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orgs);
  } catch (err: any) {
    console.error("GET /api/admin/orgs error:", err);
    return NextResponse.json({ error: "failed to fetch orgs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, domain, contact, slug } = body ?? {};

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const normalizedSlug =
      typeof slug === "string" && slug.trim()
        ? slug.trim()
        : name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");

    // Build a data object that only includes fields you intend to create.
    // If your schema doesn't have `domain` or `contact`, keep them out.
    // If you *do* have them (Option A), you can keep them in.
    const createData: any = {
      name: name.trim(),
      slug: normalizedSlug,
    };


    try {
      const org = await prisma.organization.create({
        data: createData,
        select: { id: true, name: true, slug: true, createdAt: true }, // safe select
      });
      return NextResponse.json(org, { status: 201 });
    } catch (createErr: any) {
      if (createErr?.code === "P2002" && createErr?.meta?.target?.includes("slug")) {
        const altSlug = `${normalizedSlug}-${Date.now().toString(36).slice(4)}`;
        const org = await prisma.organization.create({
          data: { ...createData, slug: altSlug },
          select: { id: true, name: true, slug: true, createdAt: true },
        });
        return NextResponse.json(org, { status: 201 });
      }
      console.error("Create org failed:", createErr);
      return NextResponse.json({ error: "create org failed" }, { status: 500 });
    }
  } catch (err: any) {
    console.error("POST /api/admin/orgs error:", err);
    return NextResponse.json({ error: "create org failed" }, { status: 500 });
  }
}
