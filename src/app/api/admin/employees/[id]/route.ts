// app/api/admin/employees/[id]/route.ts
import { NextResponse } from "next/server";
import { readJson, writeJson } from "../../../../../lib/fs";

export const runtime = "nodejs";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; orgId?: string } }
) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const id = params.id;

    if (!orgId) {
      return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const file = `employees_${orgId}.json`;

    console.log(`DELETE employee ${id} for org ${orgId}`);

    // Load employees safely (your helper likely already returns [] if missing)
    const employees = await readJson<any[]>(file, []);
    const exists = employees.some((e) => e.id === id);

    if (!exists) {
      return NextResponse.json(
        { error: `Employee ${id} not found for org ${orgId}` },
        { status: 404 }
      );
    }

    const filtered = employees.filter((e) => e.id !== id);
    await writeJson(file, filtered);

    return NextResponse.json({ success: true, id, orgId }, { status: 200 });
  } catch (err) {
    console.error("employees/[id] DELETE error:", err);
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
}
