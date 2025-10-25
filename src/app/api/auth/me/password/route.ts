// app/api/auth/me/password/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

// helper: extract JWT from Authorization header or cookies
function getTokenFromRequest(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim();
  }
  const cookie = req.headers.get("cookie") ?? "";
  if (!cookie) return null;
  const pairs = cookie.split(";").map((c) => c.trim());
  for (const p of pairs) {
    const [k, ...rest] = p.split("=");
    const v = rest.join("=");
    const key = k?.trim();
    if (!key) continue;
    if (["token", "jwt", "accessToken", "session"].includes(key)) {
      return decodeURIComponent(v);
    }
  }
  return null;
}

// helper: get userId from token (if valid)
function getUserIdFromToken(token: string | null) {
  if (!token) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(token, secret) as any;
    return payload?.userId ?? payload?.id ?? payload?.sub ?? null;
  } catch (e) {
    return null;
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, currentPassword, newPassword } = body ?? {};

    // Require at least one of name or newPassword
    if ((!name || typeof name !== "string") && (!newPassword || typeof newPassword !== "string")) {
      return NextResponse.json({ error: "Nothing to update. Provide `name` or `newPassword`." }, { status: 400 });
    }

    // authenticate user
    const token = getTokenFromRequest(req);
    const userId = getUserIdFromToken(token);
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // load current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, email: true, name: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updates: any = {};

    // 1) Handle name update (no password required)
    if (name && typeof name === "string") {
      // optional: add server-side sanitization or length checks
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      updates.name = trimmed;
    }

    // 2) Handle password update
    if (newPassword && typeof newPassword === "string") {
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
      }

      // If user already has a passwordHash, require currentPassword and validate
      if (user.passwordHash) {
        if (!currentPassword || typeof currentPassword !== "string") {
          return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 });
        }
        const match = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!match) {
          return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
        }
      } else {
        // If the user had no password (e.g. OAuth), we allow setting a new password here.
        // Alternatively, you might require a password-reset flow / token — choose accordingly.
      }

      // hash and add to updates
      const hashed = await bcrypt.hash(newPassword, 10);
      updates.passwordHash = hashed;
      updates.mustResetPassword = false;
    }

    // If no updates to apply (shouldn't happen due to earlier guard), return
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates were applied" }, { status: 400 });
    }

    // Apply the update
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, email: true, name: true, role: true },
    });

    // Build response explaining what changed
    const resp: any = { success: true, user: updated };
    if (updates.passwordHash) resp.passwordChanged = true;
    if (updates.name) resp.nameChanged = true;

    return NextResponse.json(resp, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/auth/me/password error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
