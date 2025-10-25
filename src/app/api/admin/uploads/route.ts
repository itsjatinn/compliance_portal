import { NextResponse } from "next/server";
import formidable from "formidable";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // required for file streaming

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// ✅ Ensure /public/uploads directory exists
async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * Convert Next.js Web Request (Fetch API) → Node.js readable stream.
 * Formidable requires a Node stream with `on()` methods.
 */
function toNodeStream(req: Request): Readable {
  const readable = new Readable();
  readable._read = () => {};

  // ✅ If there is no body, just end the stream
  if (!req.body) {
    readable.push(null);
    return readable;
  }

  const reader = req.body.getReader();

  // ✅ Pump the request body into the readable stream
  (function pump() {
    reader.read().then(({ done, value }) => {
      if (done) {
        readable.push(null);
        return;
      }
      readable.push(Buffer.from(value));
      pump();
    });
  })();

  return readable;
}

/**
 * Parse multipart form data using Formidable.
 */
async function parseForm(req: Request): Promise<{
  fields: Record<string, string | string[] | undefined>;
  files: Record<string, any>;
}> {
  await ensureUploadDir();
  const nodeReq = toNodeStream(req) as any;
  nodeReq.headers = Object.fromEntries(req.headers.entries());

  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      uploadDir: UPLOAD_DIR,
      keepExtensions: true,
      maxFileSize: 200 * 1024 * 1024, // 200 MB limit
      filename: (name, ext, part) => {
        const base = path.basename(part.originalFilename || "file", ext);
        const safe = base.replace(/[^a-zA-Z0-9_-]/g, "_");
        const suffix = Math.random().toString(36).slice(2, 8);
        return `${suffix}_${safe}${ext}`;
      },
    });

    form.parse(nodeReq, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

/**
 * ✅ POST handler — handles file uploads
 */
export async function POST(req: Request) {
  try {
    const { files } = await parseForm(req);
    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file || !file.filepath) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = path.basename(file.filepath);
    const fileUrl = `/uploads/${filename}`;
    console.log(`[UPLOAD] Saved: ${fileUrl}`);

    return NextResponse.json(
      { success: true, url: fileUrl, filename },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
