// app/api/course/[id]/progress/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import jwt from "jsonwebtoken";

/**
 * Resolve the current user from the request.
 * Strategy:
 * 1) If there's "Authorization: Bearer <jwt>" verify and read userId from token (payload.userId || id || sub).
 * 2) Else, if cookie "userId" exists, validate it against the users table (prisma.user).
 *
 * NOTE: Cookie-based method expects you to set a cookie named "userId" after login.
 *       This is convenient for testing; for production prefer a secure session mechanism or JWT.
 */
async function getUserFromRequest(req: NextRequest): Promise<{ id: string } | null> {
  // 1) JWT from Authorization header
  try {
    const auth = req.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const token = m[1];
      const secret = process.env.JWT_SECRET;
      if (secret) {
        try {
          const payload = jwt.verify(token, secret) as any;
          const userId = payload.userId ?? payload.id ?? payload.sub;
          if (userId) {
            // optional validation: ensure user exists
            const u = await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true } });
            if (u) return { id: u.id };
          }
        } catch (err) {
          // invalid token -> continue to cookie method
        }
      } else {
        console.warn("JWT_SECRET not set; skipping JWT verification.");
      }
    }
  } catch (err) {
    // ignore and fallthrough to cookie method
  }

  // 2) cookie "userId" (quick dev/test fallback)
  try {
    const cookieUserId = req.cookies.get("userId")?.value;
    if (cookieUserId) {
      const u = await prisma.user.findUnique({ where: { id: cookieUserId }, select: { id: true } });
      if (u) return { id: u.id };
    }
  } catch (err) {
    console.error("Error validating userId cookie:", err);
  }

  return null;
}

/* ---------- Handlers ---------- */

// GET: return saved progress percentage integer (0-100)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: courseId } = params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // find assigned course row for this user + course
    const assigned = await prisma.assignedCourse.findFirst({
      where: { userId: user.id, courseId },
      select: { id: true, progress: true, assignedAt: true },
    });

    if (!assigned) {
      return NextResponse.json({ progress: 0 }, { status: 200 });
    }

    return NextResponse.json({ progress: assigned.progress ?? 0, assignedAt: assigned.assignedAt ?? null });
  } catch (err) {
    console.error("GET progress error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT: update saved progress percentage
// Body: { progress: number }  // will be rounded to integer 0..100
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: courseId } = params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch (err) {
    // ignore; default to {}
  }

  let progress = Number(body?.progress ?? NaN);
  if (!isFinite(progress)) progress = 0;
  progress = Math.max(0, Math.min(100, Math.round(progress)));

  try {
    // find existing AssignedCourse for this user+course
    const existing = await prisma.assignedCourse.findFirst({ where: { userId: user.id, courseId } });

    let updated;
    if (existing) {
      updated = await prisma.assignedCourse.update({
        where: { id: existing.id },
        data: { progress },
      });
    } else {
      // create a new AssignedCourse. assignedAt will default to now in Prisma schema
      updated = await prisma.assignedCourse.create({
        data: {
          userId: user.id,
          courseId,
          progress,
        },
      });
    }

    return NextResponse.json({ ok: true, progress: updated.progress });
  } catch (err) {
    console.error("PUT progress error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
