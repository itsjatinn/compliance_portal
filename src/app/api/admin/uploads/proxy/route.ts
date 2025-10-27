import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  NEXT_PUBLIC_R2_PUBLIC_URL, // 👈 for public fetch URLs
} = process.env;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn(
    "[R2 Upload Proxy] ⚠️ Missing Cloudflare R2 env vars. " +
      "Uploads will fail until R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
      "R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are set."
  );
}

const endpoint = R2_ACCOUNT_ID
  ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : undefined;

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials:
    R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
      ? {
          accessKeyId: R2_ACCESS_KEY_ID,
          secretAccessKey: R2_SECRET_ACCESS_KEY,
        }
      : undefined,
  forcePathStyle: false,
});

type UploadResponse =
  | { ok: true; key: string; contentType?: string; publicUrl?: string }
  | { error: string };

const ALLOWED_FOLDERS = new Set(["videos", "thumbnails", "images", "documents"]);

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const fileField = formData.get("file") as (Blob & {
      name?: string;
      type?: string;
    }) | null;
    if (!fileField) {
      return NextResponse.json({ error: "file field missing" }, { status: 400 });
    }

    const folderRaw = (() => {
      const f = formData.get("folder");
      if (typeof f === "string") return f.replace(/(^\/|\/$)/g, "");
      return undefined;
    })();
    const folder = folderRaw && ALLOWED_FOLDERS.has(folderRaw) ? `${folderRaw}/` : "";

    const originalFilename = (fileField as any).name ?? `upload-${Date.now()}.bin`;
    const contentTypeToUse = (fileField as any).type ?? "application/octet-stream";
    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const key = `${folder}${uniqueSuffix}-${safeName}`;

    const arrayBuffer = await fileField.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const put = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: contentTypeToUse,
    });

    await s3.send(put);

    // ✅ Build public URL if bucket is exposed
    const publicUrl =
      NEXT_PUBLIC_R2_PUBLIC_URL &&
      `${NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/+$/, "")}/${encodeURIComponent(key)}`;

    const success: UploadResponse = { ok: true, key, contentType: contentTypeToUse, publicUrl };
    return NextResponse.json(success, { status: 200 });
  } catch (err: any) {
    console.error("[R2 Upload Proxy] Upload error:", err);
    const msg = err?.message ? String(err.message) : String(err);
    const body: UploadResponse = { error: msg || "upload failed" };
    return NextResponse.json(body, { status: 500 });
  }
}
