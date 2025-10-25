// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  // Clear the token cookie by setting Max-Age=0
  const expired = `token=; HttpOnly; Path=/; Max-Age=0; ${process.env.NODE_ENV === "production" ? "Secure; SameSite=None" : "SameSite=Lax"}`;
  return NextResponse.json({ ok: true }, { status: 200, headers: { "Set-Cookie": expired } });
}
