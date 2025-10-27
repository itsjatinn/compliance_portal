// src/app/api/admin/uploads/complete/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Optional: require auth/admin
  // const user = await requireAdmin(req);
  // if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { key, filename, size, folder, meta } = body ?? {};

  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  // TODO: save metadata to your DB here. Example:
  // await prisma.file.create({ data: { key, filename, size, folder, uploadedBy: user.id } });

  console.log("[UPLOAD COMPLETE] key:", key, "filename:", filename, "size:", size, "folder:", folder);

  return NextResponse.json({ ok: true, key });
}
