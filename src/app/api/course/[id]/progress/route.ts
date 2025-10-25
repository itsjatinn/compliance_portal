import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import jwt from "jsonwebtoken";
import { promises as fs } from "fs";
import path from "path";

const CERT_DIR = path.join(process.cwd(), "public", "certificates");

/* -------------------- Helper: Extract user id -------------------- */
async function getUserIdFromReq(req: Request): Promise<string | null> {
  try {
    const header = req.headers.get("x-user-id");
    if (header) return header;

    const auth = req.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice("bearer ".length).trim();
      const secret = process.env.JWT_SECRET;
      if (secret && token) {
        try {
          const decoded: any = jwt.verify(token, secret);
          return decoded?.sub ?? decoded?.userId ?? decoded?.id ?? null;
        } catch {
          console.warn("JWT verify failed (auth header)");
        }
      }
    }

    const cookieHeader = req.headers.get("cookie") ?? "";
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const idx = c.indexOf("=");
          if (idx === -1) return [c.trim(), ""];
          const key = c.slice(0, idx).trim();
          const val = decodeURIComponent(c.slice(idx + 1).trim());
          return [key, val];
        })
      );
      const token = cookies["token"] ?? cookies["auth_token"];
      if (token && process.env.JWT_SECRET) {
        try {
          const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
          return decoded?.sub ?? decoded?.userId ?? decoded?.id ?? null;
        } catch {
          console.warn("JWT verify failed (cookie)");
        }
      }
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("asUserId");
    if (q) return q;

    return null;
  } catch (err) {
    console.error("getUserIdFromReq error", err);
    return null;
  }
}

/* -------------------- GET progress -------------------- */
export async function GET(req: Request, { params }: { params: any }) {
  try {
    const courseId = await params?.id;
    if (!courseId)
      return NextResponse.json({ error: "Missing course id" }, { status: 400 });

    const userId = await getUserIdFromReq(req);
    if (!userId)
      return NextResponse.json(
        { error: "Unauthorized - no user found" },
        { status: 401 }
      );

    const progress = await prisma.progress.findFirst({
      where: { userId, courseId },
    });

    return NextResponse.json({ progress: progress ?? null }, { status: 200 });
  } catch (err: any) {
    console.error("GET /progress error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/* -------------------- PUT progress + Auto Certificate -------------------- */
export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const courseId = await params?.id;
    if (!courseId)
      return NextResponse.json({ error: "Missing course id" }, { status: 400 });

    const userId = await getUserIdFromReq(req);
    if (!userId)
      return NextResponse.json(
        { error: "Unauthorized - no user found" },
        { status: 401 }
      );

    const body = await req.json().catch(() => ({}));
    const {
      watchedSections = {},
      quizPassed = {},
      quizReports = {},
      progress = 0,
    } = body;

    // Upsert progress record
    const record = await prisma.progress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { watchedSections, quizPassed, quizReports, progress },
      create: { userId, courseId, watchedSections, quizPassed, quizReports, progress },
    });

    /* -------------------- Auto Certificate Generation -------------------- */
    if (progress >= 100) {
      try {
        // check if certificate already exists
        const existingCert = await prisma.certificate.findFirst({
          where: { userId, courseId },
        });

        if (!existingCert) {
          const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { title: true },
          });

          const learner = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });

          // try to infer orgId from AssignedCourse (if exists)
          const assignment = await prisma.assignedCourse.findFirst({
            where: { userId, courseId },
            select: { orgId: true },
          });

          const orgId = assignment?.orgId ?? null;

          if (course) {
            await fs.mkdir(CERT_DIR, { recursive: true });

            const certId = `cert_${Math.random().toString(36).slice(2, 9)}`;
            const fileName = `${courseId}_${userId}_${certId}.svg`;
            const publicPath = `/certificates/${fileName}`;
            const destPath = path.join(CERT_DIR, fileName);
            const issuedAt = new Date();

            const svg = buildCertificateSVG({
              learnerName: learner?.name ?? "Learner",
              courseTitle: course.title ?? "Course",
              issuedAt,
              certId,
              issuerName: "Compliance Academy",
            });

            await fs.writeFile(destPath, svg, "utf8");

            await prisma.certificate.create({
              data: {
                id: certId,
                userId,
                courseId,
                orgId,
                filePath: publicPath,
                issuedAt,
              },
            });

            console.log(`✅ Auto certificate created for user ${userId}`);
          }
        }
      } catch (e) {
        console.error("Auto certificate creation failed:", e);
      }
    }
    /* -------------------------------------------------------------------- */

    return NextResponse.json({ success: true, progress: record }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /progress error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/* -------------------- SVG Generator -------------------- */
function buildCertificateSVG({
  courseTitle,
  learnerName,
  issuedAt,
  certId,
  issuerName,
}: {
  courseTitle: string;
  learnerName: string;
  issuedAt: Date;
  certId: string;
  issuerName: string;
}) {
  const dateStr = issuedAt.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
    <rect width="100%" height="100%" fill="#f9fafb" rx="20"/>
    <text x="50%" y="200" font-size="48" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#1e293b">
      Certificate of Completion
    </text>
    <text x="50%" y="350" font-size="28" font-family="serif" text-anchor="middle" fill="#334155">
      This certifies that
    </text>
    <text x="50%" y="420" font-size="42" font-weight="700" text-anchor="middle" fill="#111827">
      ${escapeXml(learnerName)}
    </text>
    <text x="50%" y="520" font-size="28" font-family="serif" text-anchor="middle" fill="#334155">
      has successfully completed the course
    </text>
    <text x="50%" y="580" font-size="36" font-weight="700" text-anchor="middle" fill="#0f172a">
      ${escapeXml(courseTitle)}
    </text>
    <text x="50%" y="670" font-size="18" text-anchor="middle" fill="#475569">
      Awarded on ${escapeXml(dateStr)}
    </text>
    <text x="50%" y="720" font-size="14" text-anchor="middle" fill="#64748b">
      Certificate ID: ${escapeXml(certId)}
    </text>
    <text x="50%" y="800" font-size="16" text-anchor="middle" fill="#1e293b">
      Issued by ${escapeXml(issuerName)}
    </text>
  </svg>`;
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
