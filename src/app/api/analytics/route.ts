import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "replace_this_in_prod";

// Prisma singleton to avoid multiple clients during dev hot reload
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}
const prisma = global.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

type AnalyticsPayload = {
  totalAssigned: number;
  totalCompleted: number;
  totalCertified: number;
  progressOverTime: { week: string; progress: number }[];
  certificationStatus: { name: string; value: number }[];
  lessonsCompleted: { courseId: string; courseTitle: string; completedLessons: number }[];
  recentActivity: { id: string; text: string; when: string }[];
};

function parseRange(range?: string) {
  const now = new Date();
  const end = now;
  const start = new Date(now);
  if (range === "30d") start.setDate(now.getDate() - 30);
  else if (range === "365d") start.setDate(now.getDate() - 365);
  else start.setDate(now.getDate() - 90);
  return { start, end };
}

function getTokenFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.split(" ")[1];
  const cookie = req.cookies.get("token");
  if (cookie) return cookie.value;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    // --- Auth ---
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    let decodedToken: { userId?: string; id?: string; sub?: string };
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; sub?: string };
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = decodedToken.userId ?? decodedToken.id ?? decodedToken.sub;
    if (!userId) {
      return NextResponse.json({ error: "Token missing user id" }, { status: 401 });
    }

    // --- Query params ---
    const url = new URL(req.url);
    const rangeParam = (url.searchParams.get("range") as "30d" | "90d" | "365d") ?? "90d";
    const courseFilter = url.searchParams.get("course") ?? undefined;
    const { start, end } = parseRange(rangeParam);

    // --- 1) totalAssigned ---
    const totalAssigned = await prisma.assignedCourse.count({
      where: { userId, ...(courseFilter ? { courseId: courseFilter } : {}) },
    });

    // --- 2) totalCompleted ---
    const totalCompleted = await prisma.assignedCourse.count({
      where: {
        userId,
        progress: { gte: 100 },
        ...(courseFilter ? { courseId: courseFilter } : {}),
      },
    });

    // --- 3) totalCertified ---
    const totalCertified = await prisma.certificate.count({
      where: { userId, ...(courseFilter ? { courseId: courseFilter } : {}) },
    });

    // --- 4) lessonsCompleted ---
    const assignedWithCourse = await prisma.assignedCourse.findMany({
      where: { userId, ...(courseFilter ? { courseId: courseFilter } : {}) },
      include: { course: { select: { id: true, title: true, lessons: true } } },
    });

    const lessonsCompleted = assignedWithCourse.map((ac) => {
      const totalLessons = ac.course?.lessons ?? 0;
      const prog = ac.progress ?? 0;
      const completedLessons = Math.round((prog / 100) * totalLessons);
      return {
        courseId: ac.course?.id ?? ac.courseId,
        courseTitle: ac.course?.title ?? "Untitled course",
        completedLessons,
      };
    });

    // --- 5) progressOverTime (weekly using certificate issuedAt) ---
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerWeek));
    const certificatesInRange = await prisma.certificate.findMany({
      where: {
        userId,
        issuedAt: { gte: start, lte: end },
        ...(courseFilter ? { courseId: courseFilter } : {}),
      },
      select: { id: true, issuedAt: true },
      orderBy: { issuedAt: "asc" },
    });

    const progressOverTime: { week: string; progress: number }[] = [];
    for (let i = 0; i < weeks; i++) {
      const weekEnd = new Date(start.getTime() + (i + 1) * msPerWeek);
      const cumulativeCertified = certificatesInRange.filter(
        (c) => new Date(c.issuedAt).getTime() <= weekEnd.getTime()
      ).length;
      const percent = totalAssigned > 0 ? Math.round((cumulativeCertified / totalAssigned) * 100) : 0;
      progressOverTime.push({ week: `W${i + 1}`, progress: percent });
    }

    // --- 6) certificationStatus ---
    const certifiedCount = totalCertified;
    const notCertified = Math.max(0, totalAssigned - certifiedCount);
    const certificationStatus = [
      { name: "Certified", value: certifiedCount },
      { name: "Not certified", value: notCertified },
    ];

    // --- 7) recentActivity ---
    const [recentAssigned, recentCertificates] = await Promise.all([
      prisma.assignedCourse.findMany({
        where: { userId, ...(courseFilter ? { courseId: courseFilter } : {}) },
        include: { course: { select: { title: true } } },
        orderBy: { assignedAt: "desc" },
        take: 8,
      }),
      prisma.certificate.findMany({
        where: { userId, ...(courseFilter ? { courseId: courseFilter } : {}) },
        include: { course: { select: { title: true } } },
        orderBy: { issuedAt: "desc" },
        take: 8,
      }),
    ]);

    type Act = { id: string; text: string; when: string; ts: number };
    const acts: Act[] = [];

    recentAssigned.forEach((a) =>
      acts.push({
        id: `assigned-${a.id}`,
        text: `Assigned course "${a.course?.title ?? "course"}"`,
        when: a.assignedAt.toISOString().slice(0, 10),
        ts: a.assignedAt.getTime(),
      })
    );

    recentCertificates.forEach((c) =>
      acts.push({
        id: `cert-${c.id}`,
        text: `Certificate issued for "${c.course?.title ?? "course"}"`,
        when: c.issuedAt.toISOString().slice(0, 10),
        ts: c.issuedAt.getTime(),
      })
    );

    acts.sort((a, b) => b.ts - a.ts);
    const recentActivity = acts.slice(0, 10).map((a) => ({
      id: a.id,
      text: a.text,
      when: a.when,
    }));

    // --- Final payload (renamed to avoid conflict) ---
    const analyticsData: AnalyticsPayload = {
      totalAssigned,
      totalCompleted,
      totalCertified,
      progressOverTime,
      certificationStatus,
      lessonsCompleted,
      recentActivity,
    };

    return NextResponse.json(analyticsData, { status: 200 });
  } catch (err) {
    console.error("Analytics route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
