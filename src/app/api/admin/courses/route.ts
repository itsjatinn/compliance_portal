// src/app/api/admin/courses/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma"; // adjust if your lib path differs
import fs from "fs/promises";
import path from "path";

type LessonPayload = {
  title?: string | null;
  duration?: string | number | null; // accept string or number
  summary?: string | null;
  content?: string | null;
  resourceUrl?: string | null;
  quizUrl?: string | null;
};

type CreateCourseBody = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  duration?: string | number | null;
  image?: string | null;
  introVideo?: string | null;
  lessons?: LessonPayload[] | null;
};

/* parse duration to seconds on server as a safety net (same logic as client) */
function parseDurationToSecondsServer(input?: string | number | null): number | null {
  if (input === undefined || input === null) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.max(0, Math.floor(input));
  }
  const s = String(input).trim();
  if (!s) return null;

  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  }

  const regex = /(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?)?/i;
  const match = s.match(regex);
  if (match && (match[1] || match[2] || match[3])) {
    const hours = match[1] ? parseFloat(match[1]) : 0;
    const mins = match[2] ? parseFloat(match[2]) : 0;
    const secs = match[3] ? parseFloat(match[3]) : 0;
    return Math.round(hours * 3600 + mins * 60 + secs);
  }

  const numUnit = s.match(/^(\d+(?:\.\d+)?)([hms])$/i);
  if (numUnit) {
    const val = parseFloat(numUnit[1]);
    const unit = numUnit[2].toLowerCase();
    if (unit === "h") return Math.round(val * 3600);
    if (unit === "m") return Math.round(val * 60);
    if (unit === "s") return Math.round(val);
  }

  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
  return null;
}

function safeString(v: any): string | null {
  if (v === undefined || v === null) return null;
  return String(v);
}

function containsFileLike(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  // Node Buffer check
  if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(obj)) return true;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "object" && containsFileLike(v)) return true;
  }
  return false;
}

/* Helper: try to load a JSON quiz file from public/ path if quizUrl points to a local file.
   If not found or not parseable, returns null. */
async function tryLoadQuizFromUrl(quizUrl?: string) {
  if (!quizUrl) return null;
  try {
    const normalized = quizUrl.startsWith("/") ? quizUrl.slice(1) : quizUrl;
    const publicPath = path.join(process.cwd(), "public", normalized);
    const raw = await fs.readFile(publicPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    return null;
  }
}

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { title: "asc" },
      include: { courseLessons: true },
    });

    // Map each course but augment each section with a `lesson` object that contains:
    // - parsed content (if JSON)
    // - quizzes (from parsed content or from local quizUrl file)
    const mapped = await Promise.all(
      courses.map(async (c) => {
        const sections = await Promise.all(
          (c.courseLessons ?? []).map(async (lsn) => {
            // Parse content if it looks like JSON
            let lessonObj: any = {};
            if (lsn.content) {
              try {
                const maybe = JSON.parse(lsn.content);
                if (maybe && typeof maybe === "object") lessonObj = maybe;
              } catch (e) {
                // content not JSON, keep lessonObj empty
                lessonObj = {};
              }
            }

            // If content didn't include quizzes, and lsn.quizUrl exists, try to load local JSON file
            if (
              (!lessonObj.quizzes && !lessonObj.quiz && !lessonObj.questions && !lessonObj.assessments) &&
              lsn.quizUrl
            ) {
              const loaded = await tryLoadQuizFromUrl(lsn.quizUrl);
              if (loaded && typeof loaded === "object") {
                // prefer explicit "quizzes" key, otherwise attach whole object
                lessonObj.quizzes = Array.isArray(loaded) ? loaded : loaded.quizzes ?? loaded;
              } else {
                // attach quizUrl so client can fetch if needed
                lessonObj._quizUrl = lsn.quizUrl;
              }
            }

            // Always attach raw fields for client convenience
            const section = {
              id: lsn.id,
              title: lsn.title ?? `Lesson`,
              duration: lsn.duration ?? null,
              // keep both resourceUrl and videoUrl aliases (client tries several names)
              videoUrl: (lsn as any).videoUrl ?? lsn.resourceUrl ?? null,
              resourceUrl: lsn.resourceUrl ?? null,
              lesson: {
                ...lessonObj,
                summary: lsn.summary ?? null,
                resourceUrl: lsn.resourceUrl ?? null,
                quizUrl: lsn.quizUrl ?? null,
                contentRaw: lsn.content ?? null,
                createdAt: (lsn as any).createdAt ?? null,
              },
            };
            return section;
          })
        );

        return {
          id: c.id,
          title: c.title,
          subtitle: (c as any).subtitle ?? null,
          description: c.description ?? null,
          thumbnail: c.image ?? null,
          introVideo: c.introVideo ?? null,
          duration: c.duration ?? null, // integer seconds or null
          lessons: Array.isArray(c.courseLessons) ? c.courseLessons.length : c.lessons ?? 0,
          sections,
          uploadedAt: (c as any).createdAt ?? null,
          updatedAt: (c as any).updatedAt ?? null,
        };
      })
    );

    return NextResponse.json(mapped, { status: 200 });
  } catch (err) {
    console.error("/api/admin/courses GET error:", err);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    if (!raw || typeof raw.title !== "string" || !raw.title.trim()) {
      return NextResponse.json({ error: "Invalid payload: title required" }, { status: 400 });
    }

    const body = raw as CreateCourseBody;
    const lessonsInput = Array.isArray(body.lessons) ? body.lessons : [];

    const lessonsClean = lessonsInput
      .filter(Boolean)
      .map((l) => {
        const parsedDuration = parseDurationToSecondsServer(l.duration);
        return {
          title: safeString(l.title) ?? "",
          duration: parsedDuration, // number | null
          summary: safeString(l.summary),
          content: safeString(l.content),
          resourceUrl: safeString(l.resourceUrl),
          quizUrl: safeString(l.quizUrl),
        };
      });

    const courseDuration = parseDurationToSecondsServer(body.duration);

    const createData: any = {
      title: body.title.trim(),
      description: body.description ?? null,
      image: body.image ?? null,
      introVideo: body.introVideo ?? null,
      duration: courseDuration, // Int | null
      lessons: lessonsClean.length > 0 ? lessonsClean.length : 0,
    };

    if (lessonsClean.length > 0) {
      createData.courseLessons = {
        create: lessonsClean,
      };
    }

    if (containsFileLike(createData)) {
      console.error("Refusing to create course: file-like data detected in payload");
      return NextResponse.json({ error: "Invalid payload: contains file data" }, { status: 400 });
    }

    console.debug(
      "Creating course preview:",
      JSON.stringify({ title: createData.title, lessonsCount: createData.lessons, duration: createData.duration })
    );

    const created = await prisma.course.create({
      data: createData,
      include: { courseLessons: true },
    });

    return NextResponse.json({ success: true, course: created }, { status: 201 });
  } catch (err: any) {
    console.error("/api/admin/courses POST error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed to create course" }, { status: 500 });
  }
}
