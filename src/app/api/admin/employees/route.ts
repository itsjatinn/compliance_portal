// app/api/admin/employees/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma"; // adjust path to your prisma client

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, phone, title, role, orgId } = body;

    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: "orgId_required" }, { status: 400 });
    }

    // Optional: validate that org exists
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ error: "org_not_found" }, { status: 404 });
    }

    // Create user scoped to organization
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        name: name ?? null,
        phone: phone ?? null,
        title: title ?? null,
        role: role ?? null,
        orgId: orgId, // <-- attach organization
      },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (err: any) {
    console.error("employees POST error:", err);
    // handle unique constraint on email etc.
    return NextResponse.json({ error: "create_failed", message: String(err?.message ?? err) }, { status: 500 });
  }
}
