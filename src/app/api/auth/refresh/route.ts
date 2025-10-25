import { NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "../../../../lib/auth";
import { verifyRefreshTokenInDB, getUserById, saveRefreshToken, revokeRefreshToken } from "../../../../lib/db";

export async function POST(req: Request) {
  try {
    // Accept refresh token in body OR cookie (try body first)
    const body = await req.json().catch(() => ({}));
    let refreshToken = body?.refreshToken as string | undefined;

    // If not in body, try cookie header (cookie parsing is minimal here)
    if (!refreshToken) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/(?:^|;\s*)refreshToken=([^;]+)/);
      if (match) refreshToken = decodeURIComponent(match[1]);
    }

    if (!refreshToken) {
      return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
    }

    // Verify JWT signature and extract payload
    let payload: any;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (e) {
      return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
    }

    const userId = payload?.userId as string | undefined;
    if (!userId) return NextResponse.json({ error: "Invalid token payload" }, { status: 401 });

    // Confirm token exists in DB for this user
    const ok = await verifyRefreshTokenInDB(userId, refreshToken);
    if (!ok) return NextResponse.json({ error: "Refresh token not recognized" }, { status: 401 });

    // Optionally revoke old token and issue a new one
    await revokeRefreshToken(userId, refreshToken);
    const newRefreshToken = signRefreshToken({ userId }, 60 * 60 * 24 * 30);
    await saveRefreshToken(userId, newRefreshToken);

    // Issue new access token
    const accessToken = signAccessToken({ userId }, 60 * 15);

    // Build response and set new refresh cookie
    const res = NextResponse.json({ accessToken }, { status: 200 });
    const cookie = `refreshToken=${encodeURIComponent(newRefreshToken)}; Max-Age=${60*60*24*30}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    res.headers.append("Set-Cookie", cookie);

    return res;
  } catch (err: any) {
    console.error("Refresh error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}