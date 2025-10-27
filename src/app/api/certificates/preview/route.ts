// src/app/api/certificates/preview/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "../../../../lib/prisma"; // adjust path if needed

const { JWT_SECRET } = process.env;

/**
 * verify a JWT token and return userId (same logic you used before).
 * Accepts token from Authorization header or cookie named 'token'.
 */
function verifyTokenAndGetUserId(token: string | null): string | null {
  if (!token || !JWT_SECRET) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded?.id ?? decoded?.userId ?? decoded?.sub ?? null;
  } catch (e) {
    console.warn("JWT verify failed:", e);
    return null;
  }
}

async function getUserIdFromReq(req: Request): Promise<string | null> {
  // Authorization header
  try {
    const auth = req.headers.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice("bearer ".length).trim();
      const uid = verifyTokenAndGetUserId(token);
      if (uid) return uid;
    }
  } catch {}
  // cookie token
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const tokenFromCookie = match ? decodeURIComponent(match[1]) : null;
    const uid = verifyTokenAndGetUserId(tokenFromCookie);
    if (uid) return uid;
  } catch {}
  // optional: allow ?email=... dev fallback — remove if you don't want that
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) return user.id;
    }
  } catch {}
  return null;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    // Only allow http(s) schemes
    if (!/^https?:\/\//i.test(target)) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    // Optionally: whitelist host(s) (e.g., your R2 domain) to prevent abuse
    const allowedHosts = [process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/^https?:\/\//, "") || ""];
    const parsed = new URL(target);
    // if you wish to enforce whitelist uncomment next lines:
    // if (!allowedHosts.some((h) => h && parsed.hostname.endsWith(h))) {
    //   return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    // }

    // server-side fetch (no browser CORS issues)
    const fetched = await fetch(target, { method: "GET" });
    if (!fetched.ok) {
      return NextResponse.json({ error: `Failed to fetch resource: ${fetched.status}` }, { status: 502 });
    }

    // copy content-type if it's an SVG; otherwise return text
    const contentType = fetched.headers.get("content-type") || "image/svg+xml";
    const text = await fetched.text();

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Allow the client to embed the response in iframe or <img> as needed:
        "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_ORIGIN || "*",
      },
    });
  } catch (err) {
    console.error("preview proxy error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
