// app/api/employee/assigned/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma"; // <-- adjust if needed
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

function readTokenFromHeaders(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const tokenCookie =
    cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("token=") || c.startsWith("auth=")) || "";
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  let token = "";
  if (tokenCookie) token = tokenCookie.split("=")[1] || "";
  else if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) token = authHeader.split(" ")[1];
  return token;
}

async function getUserByEmailOrToken(email?: string, token?: string) {
  if (email) {
    return prisma.user.findUnique({ where: { email } });
  }
  if (!token) return null;
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    const userId = payload?.userId ?? payload?.id ?? payload?.sub ?? null;
    if (!userId) return null;
    return prisma.user.findUnique({ where: { id: String(userId) } });
  } catch (err) {
    console.warn("[employee/assigned] token verify failed", err);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const emailParam = url.searchParams.get("email") || undefined;

    const token = readTokenFromHeaders(req);
    const user = await getUserByEmailOrToken(emailParam, token);

    if (!user) {
      // no user found — return empty array (you can change to 401 if you prefer)
      return NextResponse.json([], { status: 200 });
    }

    // fetch assigned courses for this user
    // include basic course metadata so client can render without an extra fetch if needed
    const assignments = await prisma.assignedCourse.findMany({
      where: { userId: user.id },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        courseId: true,
        orgId: true,
        assignedById: true,
        progress: true,
        status: true,
        details: true,
        assignedAt: true,
        updatedAt: true,
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            image: true,
            introVideo: true,
            lessons: true,
          },
        },
      },
    });

    // normalize course metadata shape to what client expects (thumbnail, introVideo, quizzes/sections counts)
    const out = assignments.map((a) => ({
      id: a.id,
      courseId: a.courseId,
      createdAt: a.assignedAt,
      employeeEmails: [user.email],
      employeeIds: [user.id],
      progress: a.progress ?? 0,
      status: a.status,
      details: a.details ?? null,
      course: {
        id: a.course?.id,
        title: a.course?.title,
        description: a.course?.description,
        thumbnail: a.course?.image ?? null,
        introVideo: a.course?.introVideo ?? null,
        lessons: a.course?.lessons ?? 0,
      },
    }));

    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("/api/employee/assigned error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
