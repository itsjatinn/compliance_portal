// src/app/api/course/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";
import jwt from "jsonwebtoken";

/** ───────────────────────────────
 * Helper: extract current user id.
 * Adjust this to your custom auth.
 * ─────────────────────────────── */
async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // Example 1: from header
  const headerId = req.headers.get("x-user-id");
  if (headerId) return headerId;

  // Example 2: from Bearer token
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET ?? "");
      return decoded?.sub ?? decoded?.userId ?? decoded?.id ?? null;
    } catch {
      return null;
    }
  }

  // Example 3: from cookie named "token"
  const cookies = req.headers.get("cookie") ?? "";
  const match = cookies.match(/token=([^;]+)/);
  if (match) {
    try {
      const decoded: any = jwt.verify(match[1], process.env.JWT_SECRET ?? "");
      return decoded?.sub ?? decoded?.userId ?? decoded?.id ?? null;
    } catch {
      return null;
    }
  }

  // Example 4: query param ?asUserId=...
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("asUserId");
    if (q) return q;
  } catch {}

  return null;
}

/** ───────────────────────────────
 * GET /api/course/[id]
 * Returns single course with lessons.
 * ─────────────────────────────── */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: { courseLessons: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const formatted = {
      id: course.id,
      title: course.title,
      description: course.description,
      introVideo: course.introVideo,
      sections:
        course.courseLessons.map((l) => ({
          id: l.id,
          title: l.title ?? "Untitled lesson",
          duration: l.duration,
          type: "video",
          resourceUrl: l.resourceUrl ?? null,
          videoUrl: l.resourceUrl ?? null,
          lesson: l,
        })) ?? [],
    };

    return NextResponse.json({ course: formatted });
  } catch (err) {
    console.error("GET /api/course/[id] error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** ───────────────────────────────
 * PUT /api/course/[id]/progress
 * Saves or creates per-user progress.
 * ─────────────────────────────── */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const courseId = params.id;
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { watchedSections = {}, quizPassed = {}, quizReports = {}, progress = 0 } = body;

    // uses compound unique key (userId, courseId)
    const record = await prisma.progress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { watchedSections, quizPassed, quizReports, progress },
      create: { userId, courseId, watchedSections, quizPassed, quizReports, progress },
    });

    return NextResponse.json({ success: true, progress: record });
  } catch (err) {
    console.error("PUT /api/course/[id]/progress error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
