// src/app/api/admin/orgs/[id]/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type Employee = { id: string; name: string; email?: string; role?: string; createdAt?: string };
type Org = { id: string; name: string; employees?: Employee[] };

const DATA_DIR = path.join(process.cwd(), "data");
const EMP_FILE = (orgId: string) => path.join(DATA_DIR, `employees_${orgId}.json`);
const ORGS_FILE = path.join(DATA_DIR, "orgs.json");

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

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

function makeId(prefix = "emp") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * GET - list employees for an org
 */
export async function GET(req: NextRequest, ctx: { params: { id?: string } | Promise<{ id?: string }> }) {
  try {
    const params = await (ctx.params as Promise<{ id?: string }> | { id?: string });
    const orgId = params?.id;
    console.log("GET employees for org:", orgId);
    if (!orgId) return json({ error: "id required" }, 400);

    // check per-org employees file first
    const empFile = EMP_FILE(orgId);
    const employees = await readJsonSafe<Employee[]>(empFile, []);
    if (employees.length > 0) return json(employees, 200);

    // fall back to nested orgs.json
    const orgs = await readJsonSafe<Org[]>(ORGS_FILE, []);
    const org = orgs.find((o) => String(o.id) === String(orgId));
    if (org && Array.isArray(org.employees) && org.employees.length > 0) {
      return json(org.employees, 200);
    }

    return json({ error: "no employees found" }, 404);
  } catch (err) {
    console.error("orgs/[id]/employees GET error:", err);
    return json({ error: "failed" }, 500);
  }
}

/**
 * POST - add an employee to the org
 */
export async function POST(req: NextRequest, ctx: { params: { id?: string } | Promise<{ id?: string }> }) {
  try {
    // IMPORTANT: await params before using
    const params = await (ctx.params as Promise<{ id?: string }> | { id?: string });
    const orgId = params?.id;
    console.log("POST add employee for org:", orgId);

    if (!orgId) return json({ error: "org id required in path" }, 400);

    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").toString().trim();
    const email = body?.email ? String(body.email).trim() : undefined;
    const role = body?.role ? String(body.role) : undefined;

    if (!name || !email) return json({ error: "name and email required" }, 400);

    const newEmp: Employee = { id: makeId(), name, email, role, createdAt: new Date().toISOString() };

    // persist to per-org file
    const empFile = EMP_FILE(orgId);
    const list = await readJsonSafe<Employee[]>(empFile, []);
    list.push(newEmp);
    await writeJsonAtomic(empFile, list);

    console.log(`Added employee ${newEmp.id} to org ${orgId}`);
    return json({ success: true, employee: newEmp }, 201);
  } catch (err) {
    console.error("orgs/[id]/employees POST error:", err);
    return json({ error: "failed to add employee" }, 500);
  }
}

/**
 * DELETE - org-scoped delete by email
 * DELETE /api/admin/orgs/:id/employees?email=someone@example.com
 */
export async function DELETE(req: NextRequest, ctx: { params: { id?: string } | Promise<{ id?: string }> }) {
  try {
    const params = await (ctx.params as Promise<{ id?: string }> | { id?: string });
    const orgId = params?.id;
    if (!orgId) return json({ error: "org id required in path" }, 400);

    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    if (!email) return json({ error: "email required" }, 400);

    const empFile = EMP_FILE(orgId);
    const list = await readJsonSafe<Employee[]>(empFile, []);
    const idx = list.findIndex((e) => String(e.email || "").toLowerCase() === String(email).toLowerCase());
    if (idx === -1) {
      // try fallback to orgs.json nested employees (if you use that pattern)
      const orgs = await readJsonSafe<Org[]>(ORGS_FILE, []);
      const org = orgs.find((o) => String(o.id) === String(orgId));
      if (org && Array.isArray(org.employees)) {
        const idx2 = org.employees.findIndex((e) => String(e.email || "").toLowerCase() === String(email).toLowerCase());
        if (idx2 !== -1) {
          const removed = org.employees.splice(idx2, 1)[0];
          await writeJsonAtomic(ORGS_FILE, orgs);
          console.log(`Deleted employee ${removed.id} (${removed.email}) from org ${orgId} (nested orgs.json)`);
          return json({ success: true, removed }, 200);
        }
      }
      return json({ error: "not found" }, 404);
    }

    const removed = list.splice(idx, 1)[0];
    await writeJsonAtomic(empFile, list);
    console.log(`Deleted employee ${removed.id} (${removed.email}) from org ${orgId}`);
    return json({ success: true, removed }, 200);
  } catch (err) {
    console.error("orgs/[id]/employees DELETE error:", err);
    return json({ error: "failed to delete employee" }, 500);
  }
}
