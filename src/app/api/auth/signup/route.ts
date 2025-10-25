// app/api/auth/signup/route.ts (snippet)
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const emailRaw = body?.email;
  const passwordRaw = body?.password;
  const nameRaw = body?.name ?? null;

  if (!emailRaw || !passwordRaw) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const email = String(emailRaw).trim().toLowerCase();
  const hashed = await bcrypt.hash(String(passwordRaw), 10);

  try {
    const created = await prisma.user.create({
      data: { email, name: typeof nameRaw === "string" ? String(nameRaw).trim() : null, passwordHash: hashed, mustResetPassword: false },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return NextResponse.json({ success: true, user: created }, { status: 201 });
  } catch (err: any) {
    console.error("signup error:", err);
    // handle unique constraint
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
