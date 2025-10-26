// app/api/admin/employees/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma"; // adjust path

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId_required" }, { status: 400 });

    const user = await prisma.user.findFirst({
      where: { id: String(id), orgId: String(orgId) },
    });

    if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ user }, { status: 200 });
  } catch (err: any) {
    console.error("employees/[id] GET error:", err);
    return NextResponse.json({ error: "server_error", message: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId_required" }, { status: 400 });

    const allowed = ["name", "email", "role", "isActive", "phone", "title"];
    const data: any = {};
    for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) data[k] = body[k];

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
    }

    const updated = await prisma.user.updateMany({
      where: { id: String(id), orgId: String(orgId) },
      data,
    });

    if (updated.count === 0) return NextResponse.json({ error: "not_found_or_not_authorized" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: String(id) } });
    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (err: any) {
    console.error("employees/[id] PATCH error:", err);
    return NextResponse.json({ error: "update_failed", message: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "orgId_required" }, { status: 400 });

    const deleted = await prisma.user.deleteMany({
      where: { id: String(id), orgId: String(orgId) },
    });

    if (deleted.count === 0) return NextResponse.json({ error: "not_found_or_not_authorized" }, { status: 404 });
    return NextResponse.json({ success: true, deleted: deleted.count }, { status: 200 });
  } catch (err: any) {
    console.error("employees/[id] DELETE error:", err);
    return NextResponse.json({ error: "delete_failed", message: String(err?.message ?? err) }, { status: 500 });
  }
}
