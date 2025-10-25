// src/app/api/auth/me/avatar/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // authenticate user
  // NOTE: In Node runtimes, Request.formData() works in the Edge runtime
  try {
    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Basic validation (do this server-side properly)
    const maxSize = 5 * 1024 * 1024; // 5MB
    // file.size may be undefined in some runtimes - adapt to your environment
    // For a real implementation, parse and stream the file to your storage provider (S3/Cloudinary)
    // Example placeholder: pretend we uploaded and return a URL
    const fakeImageUrl = "https://images.example.com/users/user_123/avatar.jpg";

    // TODO: upload file to storage & update user's image url in DB

    return NextResponse.json({ imageUrl: fakeImageUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
