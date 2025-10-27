import { NextResponse } from "next/server";
import prisma from "../../../../../lib/prisma";
import jwt from "jsonwebtoken";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/* -------------------- R2 CONFIG -------------------- */
const R2 = new S3Client({
  region: "auto",
  endpoint:
    process.env.R2_ENDPOINT ||
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

/* -------------------- USER ID EXTRACTION -------------------- */
async function getUserIdFromReq(req: Request): Promise<string | null> {
  try {
    const header = req.headers.get("x-user-id");
    if (header) return header;

    const auth = req.headers.get("authorization");
    if (auth?.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice("bearer ".length).trim();
      const secret = process.env.JWT_SECRET;
      if (secret && token) {
        const decoded: any = jwt.verify(token, secret);
        return decoded?.sub ?? decoded?.userId ?? decoded?.id ?? null;
      }
    }

    const cookieHeader = req.headers.get("cookie") ?? "";
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const i = c.indexOf("=");
          return [
            c.slice(0, i).trim(),
            decodeURIComponent(c.slice(i + 1).trim()),
          ];
        })
      );
      const token = cookies["token"] ?? cookies["auth_token"];
      if (token && process.env.JWT_SECRET) {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        return decoded?.sub ?? decoded?.userId ?? decoded?.id ?? null;
      }
    }

    const url = new URL(req.url);
    return url.searchParams.get("asUserId");
  } catch {
    return null;
  }
}

/* -------------------- R2 UPLOAD HELPER -------------------- */
async function uploadCertificateToR2({
  userId,
  courseId,
  svg,
  certId,
}: {
  userId: string;
  courseId: string;
  svg: string;
  certId: string;
}) {
  const key = `certificates/${userId}/${courseId}_${certId}.svg`;
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: svg,
    ContentType: "image/svg+xml",
  });
  await R2.send(cmd);
  return `${R2_PUBLIC}/${key}`;
}

/* -------------------- GET PROGRESS -------------------- */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  if (!courseId)
    return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const progress = await prisma.progress.findFirst({
    where: { userId, courseId },
  });
  return NextResponse.json({ progress }, { status: 200 });
}

/* -------------------- PUT PROGRESS + CERT GENERATION -------------------- */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  if (!courseId)
    return NextResponse.json({ error: "Missing course id" }, { status: 400 });

  const userId = await getUserIdFromReq(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { watchedSections = {}, quizPassed = {}, quizReports = {}, progress = 0 } =
    body;

  // Upsert progress
  const record = await prisma.progress.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { watchedSections, quizPassed, quizReports, progress },
    create: { userId, courseId, watchedSections, quizPassed, quizReports, progress },
  });

  /* ---- AUTO-CERTIFICATE WHEN COURSE COMPLETED ---- */
  const normalizedProgress = Math.round(progress);
  console.log("✅ PUT /progress for", { userId, courseId, normalizedProgress });

  if (normalizedProgress >= 100) {
    console.log("🎯 100% progress reached, attempting certificate creation...");

    try {
      const existing = await prisma.certificate.findFirst({
        where: { userId, courseId },
      });

      if (!existing) {
        const [course, learner, assignment] = await Promise.all([
          prisma.course.findUnique({
            where: { id: courseId },
            select: { title: true },
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
          prisma.assignedCourse.findFirst({
            where: { userId, courseId },
            select: { orgId: true },
          }),
        ]);

        const certId = `cert_${Math.random().toString(36).slice(2, 9)}`;
        const orgId = assignment?.orgId ?? null;
        const issuedAt = new Date();
        const svg = buildCertificateSVG({
          learnerName: learner?.name ?? "Learner",
          courseTitle: course?.title ?? "Course",
          issuedAt,
          certId,
          issuerName: "Compliance Academy",
        });

        console.log("📦 Uploading certificate to R2...");
        const publicUrl = await uploadCertificateToR2({
          userId,
          courseId,
          svg,
          certId,
        });

        await prisma.certificate.create({
          data: {
            id: certId,
            userId,
            courseId,
            orgId,
            filePath: publicUrl,
            issuedAt,
          },
        });

        console.log(`✅ Certificate uploaded to R2: ${publicUrl}`);
      }
    } catch (err) {
      console.error("❌ Certificate generation failed:", err);
    }
  }

  return NextResponse.json({ success: true, progress: record }, { status: 200 });
}

/* -------------------- SVG BUILDER (ornate certificate layout) -------------------- */
function escapeXml(str: string) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  // Colors and small tweaks — adjust if you want different palette
  const bg = "#fbfdf9";
  const accent = "#9aa88a"; // greenish accent
  const text = "#0f172a";
  const muted = "#475569";

  const nameEsc = escapeXml(learnerName);
  const courseEsc = escapeXml(courseTitle);
  const dateEsc = escapeXml(dateStr);
  const idEsc = escapeXml(certId);
  const issuerEsc = escapeXml(issuerName);

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="Certificate">
    <defs>
      <pattern id="wave" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M0 40 Q20 0 40 40 T80 40" fill="none" stroke="${accent}" stroke-opacity="0.06" stroke-width="2"/>
      </pattern>

      <g id="cornerOrn">
        <path d="M0 0 C30 10 30 40 0 60" stroke="${accent}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>

      <radialGradient id="sealGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0.12"/>
      </radialGradient>
    </defs>

    <!-- background -->
    <rect width="100%" height="100%" fill="${bg}" />
    <rect width="100%" height="100%" fill="url(#wave)" opacity="0.65" />

    <!-- ornate outer borders -->
    <g transform="translate(18,18)">
      <rect x="12" y="12" width="1576" height="976" rx="22" ry="22" fill="none" stroke="${accent}" stroke-width="6" />
      <rect x="36" y="36" width="1528" height="928" rx="14" ry="14" fill="none" stroke="${accent}" stroke-width="2" />
      <use href="#cornerOrn" x="40" y="40" />
      <use href="#cornerOrn" x="1520" y="40" transform="scale(-1,1) translate(-1600,0)" />
      <use href="#cornerOrn" x="40" y="920" transform="scale(1,-1) translate(0,-1000)" />
      <use href="#cornerOrn" x="1520" y="920" transform="scale(-1,-1) translate(-1600,-1000)" />
    </g>

    <!-- heading -->
    <text x="50%" y="150" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="56" font-weight="700" fill="${text}">
      CERTIFICATE
    </text>
    <text x="50%" y="190" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="20" fill="${muted}" letter-spacing="2">
      OF APPRECIATION
    </text>

    <!-- subheading -->
    <text x="50%" y="250" text-anchor="middle" font-family="serif" font-size="14" fill="${muted}" opacity="0.9">
      THIS CERTIFICATE IS PROUDLY PRESENTED TO
    </text>

    <!-- recipient name -->
    <rect x="160" y="300" width="1280" height="110" rx="8" fill="#ffffff" fill-opacity="0.65"/>
    <text x="50%" y="375" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="700" fill="#123024">
      ${nameEsc}
    </text>

    <!-- course line -->
    <text x="50%" y="445" text-anchor="middle" font-family="serif" font-size="18" fill="${muted}">
      has successfully completed the course
    </text>

    <text x="50%" y="495" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" fill="${text}">
      ${courseEsc}
    </text>

    <!-- optional description paragraph -->
    <foreignObject x="180" y="520" width="1240" height="70">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:${muted}; text-align:center; line-height:1.2;">
        ${escapeXml("Lorem ipsum dolor sit amet, consectetur adipiscing elit. This certificate recognizes the learner's achievement.")}
      </div>
    </foreignObject>

    <!-- signatures -->
    <g transform="translate(160,650)">
      <line x1="0" y1="40" x2="300" y2="40" stroke="${muted}" stroke-width="1.4" />
      <text x="150" y="70" text-anchor="middle" font-family="serif" font-size="14" fill="${text}" font-weight="600">Charles Blake</text>
      <text x="150" y="90" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${muted}">President Director</text>
    </g>

    <!-- center seal -->
    <g transform="translate(740,620)">
      <circle cx="80" cy="40" r="60" fill="url(#sealGrad)" stroke="${accent}" stroke-width="3" />
      <circle cx="80" cy="40" r="42" fill="${bg}" stroke="${accent}" stroke-width="2" />
      <text x="80" y="45" text-anchor="middle" font-family="Georgia, serif" font-size="32" font-weight="700" fill="${accent}">C</text>
    </g>

    <g transform="translate(1080,650)">
      <line x1="0" y1="40" x2="300" y2="40" stroke="${muted}" stroke-width="1.4" />
      <text x="150" y="70" text-anchor="middle" font-family="serif" font-size="14" fill="${text}" font-weight="600">Julie S. Smith</text>
      <text x="150" y="90" text-anchor="middle" font-family="sans-serif" font-size="12" fill="${muted}">General Manager</text>
    </g>

    <!-- issued date & id -->
    <text x="320" y="860" font-family="sans-serif" font-size="14" fill="${muted}">
      Awarded on ${dateEsc}
    </text>
    <text x="1280" y="860" text-anchor="end" font-family="monospace" font-size="13" fill="${muted}">
      Certificate ID: ${idEsc}
    </text>

    <!-- issuer line -->
    <text x="50%" y="920" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${muted}">
      Issued by ${issuerEsc}
    </text>
  </svg>`;
}
