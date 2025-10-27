import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/* -------------------- R2 CONFIG -------------------- */
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  NEXT_PUBLIC_R2_PUBLIC_URL,
  JWT_SECRET,
  R2_ENDPOINT, // optional custom endpoint
} = process.env;

const R2_ENDPOINT_RESOLVED =
  R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn("R2 credentials are not fully configured in environment variables.");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT_RESOLVED,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

/* -------------------- AUTH HELPERS -------------------- */
/**
 * Try to verify a JWT and return the user id if present in token payload.
 * Accepts tokens with payload keys: id, userId, sub
 */
function verifyTokenAndGetUserId(token: string | null): string | null {
  if (!token || !JWT_SECRET) return null;
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded?.id ?? decoded?.userId ?? decoded?.sub ?? null;
  } catch (err) {
    // verification failed
    console.warn("JWT verify failed:", err);
    return null;
  }
}

/**
 * Resolve user id from request.
 * Order:
 *  1) Authorization: Bearer <token>
 *  2) cookie named 'token'
 *  3) query param ?email=... -> lookup user id (DEVELOPMENT / fallback only)
 */
async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // 1) Authorization header (Bearer)
  try {
    const auth = req.headers.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const token = auth.slice("bearer ".length).trim();
      const uid = verifyTokenAndGetUserId(token);
      if (uid) return uid;
    }
  } catch (e) {
    // continue to next fallback
  }

  // 2) cookie token
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const tokenFromCookie = match ? decodeURIComponent(match[1]) : null;
    const uid = verifyTokenAndGetUserId(tokenFromCookie);
    if (uid) return uid;
  } catch (e) {
    // continue
  }

  // 3) email query fallback (resolve user id from DB) — optional and should be used only for dev/testing
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) return user.id;
    }
  } catch (e) {
    // ignore
  }

  return null;
}

/* -------------------- XML ESCAPE -------------------- */
function escapeXml(str: string) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* -------------------- SVG BUILDER (ornate certificate layout) -------------------- */
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

/* -------------------- R2 UPLOAD -------------------- */
async function uploadToR2(key: string, svgContent: string) {
  if (!R2_BUCKET_NAME) throw new Error("R2_BUCKET_NAME not configured");
  const putCmd = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME!,
    Key: key,
    Body: Buffer.from(svgContent),
    ContentType: "image/svg+xml",
  });

  await s3.send(putCmd);

  const publicUrl = `${NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/+$/, "")}/${encodeURI(
    key
  )}`;
  return publicUrl;
}

/* -------------------- GET /api/certificates -------------------- */
export async function GET(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const certs = await prisma.certificate.findMany({
      where: { userId },
      include: { course: true },
      orderBy: { issuedAt: "desc" },
    });

    const data = certs.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      courseTitle: c.course?.title ?? null,
      url: c.filePath, // already full R2 public URL
      issuedAt: c.issuedAt,
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /certificates error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* -------------------- POST /api/certificates -------------------- */
export async function POST(req: Request) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as any));
    // prefer provided id, else generate one
    const id = (body.id as string) || (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const courseId = body.courseId;
    const courseTitle = body.courseTitle ?? "Course";
    const issuedAt = body.issuedAt ? new Date(body.issuedAt) : new Date();
    const learnerName = body.learnerName ?? "Learner";

    if (!courseId) {
      return NextResponse.json({ error: "Missing courseId" }, { status: 400 });
    }

    // check if already exists for this user+course (prevent duplicates)
    const exists = await prisma.certificate.findFirst({
      where: { userId, courseId },
    });
    if (exists) {
      return NextResponse.json({ message: "Already exists" }, { status: 200 });
    }

    const svg = buildCertificateSVG({
      learnerName,
      courseTitle,
      issuedAt,
      certId: id,
      issuerName: "Compliance Academy",
    });

    const key = `certificates/${userId}/${courseId}_${id}.svg`;
    const publicUrl = await uploadToR2(key, svg);

    const cert = await prisma.certificate.create({
      data: {
        id,
        userId,
        courseId,
        filePath: publicUrl,
        issuedAt,
      },
    });

    return NextResponse.json(cert, { status: 201 });
  } catch (err) {
    console.error("POST /certificates error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

