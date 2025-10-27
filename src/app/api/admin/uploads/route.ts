// src/app/api/admin/uploads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  throw new Error(
    "Missing Cloudflare R2 env vars. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
  );
}

const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

/**
 * S3Client configured to use Cloudflare R2
 */
const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
});

type Body = {
  filename: string;
  contentType?: string;
  folder?: string; // optional: "videos" or "certificates"
  expiresInSeconds?: number;
};

const ALLOWED_FOLDERS = new Set(["videos", "images", "certificates", "documents", "thumbnails"]); // adjust to your needs

export async function POST(req: NextRequest) {
  // Optional: enforce admin auth here
  // const user = await requireAdmin(req);
  // if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch (err) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body?.filename) {
    return NextResponse.json({ error: "filename required" }, { status: 400 });
  }

  // sanitize and validate folder
  let folder = "";
  if (body.folder) {
    const cleaned = body.folder.replace(/(^\/|\/$)/g, "");
    if (!ALLOWED_FOLDERS.has(cleaned)) {
      return NextResponse.json({ error: "invalid folder" }, { status: 400 });
    }
    folder = `${cleaned}/`;
  }

  // safe filename
  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `${folder}${uniqueSuffix}-${safeName}`;

  const contentType = body.contentType || "application/octet-stream";

  const putParams = {
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  };

  try {
    const command = new PutObjectCommand(putParams);
    // clamp expiry: at least 60s, default 1hr, max 24h
    const expiresIn = Math.max(60, Math.min(body.expiresInSeconds ?? 3600, 60 * 60 * 24));
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });

    // Return signed PUT URL and the object key (store key in DB instead of signed URL)
    return NextResponse.json({ url: signedUrl, key, contentType, expiresIn });
  } catch (err) {
    console.error("R2 presign error:", err);
    return NextResponse.json({ error: "failed to generate upload url" }, { status: 500 });
  }
}
