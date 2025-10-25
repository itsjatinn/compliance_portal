import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";

const JWT_SECRET = process.env.JWT_SECRET || "";
const CERT_DIR = path.join(process.cwd(), "public", "certificates");

/** Extract userId from cookie or Authorization header */
function getUserIdFromRequest(req: Request): string | null {
  try {
    // 1️⃣ Authorization: Bearer <token>
    const auth = req.headers.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice("bearer ".length).trim();
      if (token && JWT_SECRET) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          return decoded?.id ?? decoded?.userId ?? decoded?.sub ?? null;
        } catch (e) {
          console.warn("JWT verify failed (authorization)", e);
        }
      }
    }

    // 2️⃣ Cookie check
    const cookieHeader = req.headers.get("cookie") || "";
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const idx = c.indexOf("=");
          if (idx === -1) return [c.trim(), ""];
          const name = c.slice(0, idx).trim();
          const val = decodeURIComponent(c.slice(idx + 1).trim());
          return [name, val];
        })
      );

      const token =
        cookies["token"] ||
        cookies["auth_token"] ||
        cookies["next-auth.session-token"];

      if (token && JWT_SECRET) {
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          return decoded?.id ?? decoded?.userId ?? decoded?.sub ?? null;
        } catch (e) {
          console.warn("JWT verify failed (cookie)", e);
        }
      }
    }

    // 3️⃣ Dev fallback (?asUserId=xxx)
    if (process.env.NODE_ENV !== "production") {
      try {
        const url = new URL(req.url);
        const asUserId = url.searchParams.get("asUserId");
        if (asUserId) {
          console.warn("Using dev fallback asUserId:", asUserId);
          return asUserId;
        }
      } catch {}
    }

    return null;
  } catch (err) {
    console.error("getUserIdFromRequest error:", err);
    return null;
  }
}

/** GET certificates for user */
export async function GET(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      console.warn("❌ Unauthorized - no userId from JWT");
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const certs = await prisma.certificate.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { issuedAt: "desc" },
    });

    const res = certs.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      courseTitle: c.course?.title ?? null,
      url: c.filePath,
      issuedAt: c.issuedAt,
    }));

    return NextResponse.json(res);
  } catch (err) {
    console.error("certificates GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST certificate from frontend */
export async function POST(req: Request) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { id, courseId, courseTitle, issuedAt, svgBase64 } = await req.json();

    // Save SVG file
    await fs.mkdir(CERT_DIR, { recursive: true });
    const filename = `${courseId}_${userId}_${id}.svg`;
    const filePath = path.join(CERT_DIR, filename);
    const buffer = Buffer.from(svgBase64, "base64");
    await fs.writeFile(filePath, buffer);

    const cert = await prisma.certificate.create({
      data: {
        id,
        userId,
        courseId,
        filePath: `/certificates/${filename}`,
        issuedAt: new Date(issuedAt),
      },
    });

    return NextResponse.json({
      id: cert.id,
      courseId: cert.courseId,
      courseTitle,
      url: cert.filePath,
      issuedAt: cert.issuedAt,
    });
  } catch (err) {
    console.error("certificates POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
