// app/api/auth/_utils.ts  (utility module — optional but convenient)
import jwt, { SignOptions } from "jsonwebtoken";

export function parseExpiresToSeconds(val?: string): number {
  const DEFAULT_SECONDS = 7 * 24 * 60 * 60; // 7 days
  if (!val) return DEFAULT_SECONDS;
  const n = Number(val);
  if (!Number.isNaN(n) && n > 0) return Math.floor(n);
  const m = String(val).match(/^(\d+)([smhd])$/i);
  if (m) {
    const num = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === "s") return num;
    if (unit === "m") return num * 60;
    if (unit === "h") return num * 60 * 60;
    if (unit === "d") return num * 24 * 60 * 60;
  }
  return DEFAULT_SECONDS;
}

export function buildCookie(token: string, maxAgeSeconds: number) {
  const isProd = process.env.NODE_ENV === "production";
  // For local dev (http://localhost) we avoid Secure so cookies can be set; in prod use Secure + SameSite=None for cross-site.
  const secureFlag = isProd ? "Secure; " : "";
  const sameSite = isProd ? "None" : "Lax";
  // Example cookie: token=XXX; HttpOnly; Path=/; Max-Age=604800; Secure; SameSite=None
  return `token=${token}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; ${secureFlag}SameSite=${sameSite}`;
}
