// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

export async function GET(req: Request) {
  try {
    // 1) try to read token from cookie(s)
    const cookieHeader = req.headers.get("cookie") || "";
    // Accept token from cookie named "token" or "auth" (common names)
    const tokenCookie =
      cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("token=") || c.startsWith("auth=")) || "";

    // 2) also accept Authorization header (Bearer)
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    let token = "";

    if (tokenCookie) {
      token = tokenCookie.split("=")[1] || "";
    } else if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // DEBUG: helpful logs while debugging token issues (remove/quiet in prod)
    // eslint-disable-next-line no-console
    console.debug("/api/auth/me cookieHeader:", cookieHeader);
    // eslint-disable-next-line no-console
    console.debug("/api/auth/me authHeader:", authHeader);

    if (!token) {
      // no token provided -> unauthenticated but return 200 with user:null (your previous behavior)
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // 3) verify token
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("/api/auth/me: token verify failed", err);
      // Token invalid -> treat as unauthenticated
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // DEBUG: show decoded payload so you can inspect actual fields
    // eslint-disable-next-line no-console
    console.debug("/api/auth/me decoded payload:", payload);

    // 4) accept common id field names (userId, id, sub)
    const userId = payload?.userId ?? payload?.id ?? payload?.sub ?? null;

    if (!userId) {
      // eslint-disable-next-line no-console
      console.warn("/api/auth/me: no user id found in token payload");
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // 5) fetch user from Prisma
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { id: true, name: true, email: true, role: true },
    });

    // 6) return user (or null if not found)
    return NextResponse.json({ user: user ?? null }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/api/auth/me error:", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
