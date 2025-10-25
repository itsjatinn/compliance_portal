// src/app/api/admin/orgs/[id]/employees/[employeeId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const EMP_FILE = (orgId: string) => path.join(DATA_DIR, `employees_${orgId}.json`);

async function readJsonSafe<T>(file: string, def: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw || "null") as T;
  } catch (e: any) {
    if (e?.code === "ENOENT") return def;
    console.error("readJsonSafe error reading", file, e);
    throw e;
  }
}

async function writeJsonAtomic(file: string, data: unknown) {
  const tmp = file + ".tmp";
  await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => {});
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/**
 * DELETE /api/admin/orgs/:id/employees/:employeeId
 */
export async function DELETE(_req: NextRequest, ctx: { params: { id?: string; employeeId?: string } | Promise<{ id?: string; employeeId?: string }> }) {
  try {
    const params = await (ctx.params as Promise<{ id?: string; employeeId?: string }> | { id?: string; employeeId?: string });
    const orgId = params?.id;
    const employeeId = params?.employeeId;
    if (!orgId || !employeeId) return NextResponse.json({ error: "orgId and employeeId required" }, { status: 400 });

    const empFile = EMP_FILE(orgId);
    const list = await readJsonSafe<any[]>(empFile, []);
    const idx = list.findIndex((e) => String(e.id) === String(employeeId));
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const removed = list.splice(idx, 1)[0];
    await writeJsonAtomic(empFile, list);
    console.log(`Deleted employee ${removed.id} (${removed.email}) from org ${orgId}`);
    return NextResponse.json({ success: true, removed }, { status: 200 });
  } catch (err) {
    console.error("org-scoped employee DELETE error:", err);
    return NextResponse.json({ error: "failed to delete" }, { status: 500 });
  }
}
