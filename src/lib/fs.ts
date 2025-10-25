// lib/fs.ts
import { promises as fs } from "fs";
import path from "path";

export const DATA_DIR = path.resolve(process.cwd(), "data");
export const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");

export async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/**
 * Read JSON from disk and return typed result.
 * The generic T is IMPORTANT so callers can do readJson<MyType[]>("file.json", []).
 */
export async function readJson<T = any>(filename: string, fallback: T): Promise<T> {
  await ensureDirs();
  const file = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (e) {
    return fallback;
  }
}

export async function writeJson(filename: string, data: any) {
  await ensureDirs();
  const file = path.join(DATA_DIR, filename);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export function uploadsDir() {
  return UPLOADS_DIR;
}

export function publicUploadUrl(filename: string) {
  return `/uploads/${filename}`;
}
