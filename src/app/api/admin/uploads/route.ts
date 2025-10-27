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
  // optional: allow passing allowed origins via env
  NEXT_PUBLIC_ALLOWED_ORIGINS = "*",
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

// helper to add CORS headers (adjust allowed origins as needed)
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "3600",
  };
}

// OPTIONS handler for preflight
export function OPTIONS(_: NextRequest) {
  const headers = corsHeaders(NEXT_PUBLIC_ALLOWED_ORIGINS || "*");
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req: NextRequest) {
  // add CORS headers to response
  const origin = req.headers.get("origin") || NEXT_PUBLIC_ALLOWED_ORIGINS || "*";

  // Optional: enforce admin auth here
  // const user = await requireAdmin(req);
  // if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  if (!body?.filename) {
    return new NextResponse(JSON.stringify({ error: "filename required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  // sanitize and validate folder
  let folder = "";
  if (body.folder) {
    const cleaned = body.folder.replace(/(^\/|\/$)/g, "");
    if (!ALLOWED_FOLDERS.has(cleaned)) {
      return new NextResponse(JSON.stringify({ error: "invalid folder" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
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

    const payload = { url: signedUrl, key, contentType, expiresIn };

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (err) {
    console.error("R2 presign error:", err);
    return new NextResponse(JSON.stringify({ error: "failed to generate upload url" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
}
