import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ✅ GET single course
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: { courseLessons: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(course, { status: 200 });
  } catch (err: any) {
    console.error("GET /courses/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch course" }, { status: 500 });
  }
}

// ✅ PATCH update course (and replace lessons)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { title, description, duration, image, introVideo, lessons } = body;

    const updated = await prisma.course.update({
      where: { id: params.id },
      data: {
        title,
        description,
        duration,
        image,
        introVideo,
        lessons: Array.isArray(lessons) ? lessons.length : undefined,
        courseLessons: Array.isArray(lessons)
          ? {
              deleteMany: {}, // clear old lessons
              create: lessons.map((l: any) => ({
                title: l.title,
                duration: l.duration,
                summary: l.summary,
                content: l.content,
                resourceUrl: l.resourceUrl ?? null,
                quizUrl: l.quizUrl ?? null,
              })),
            }
          : undefined,
      },
      include: { courseLessons: true },
    });

    return NextResponse.json({ success: true, course: updated }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /courses/[id] error:", err);
    return NextResponse.json({ error: "Failed to update course", details: err.message }, { status: 500 });
  }
}

// ✅ DELETE course
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.course.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Course deleted" }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /courses/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete course", details: err.message }, { status: 500 });
  }
}
