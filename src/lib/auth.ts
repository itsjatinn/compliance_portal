// src/lib/auth.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers"; // <-- added for getCurrentUser

/* -------------------------
   Existing cookie / JWT helpers
   ------------------------- */

type SameSite = "lax" | "strict" | "none";

export interface CookieOptions {
  maxAge?: number; // seconds
  httpOnly?: boolean;
  path?: string;
  secure?: boolean;
  sameSite?: SameSite;
  domain?: string;
}

/**
 * Verify password (bcrypt)
 */
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/**
 * Create a Set-Cookie header string for a cookie.
 * Accepts either a number (maxAge seconds) or a CookieOptions object.
 */
export function createCookie(name: string, value: string, opts?: number | CookieOptions): string {
  const defaultOpts: CookieOptions = {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };

  const options: CookieOptions =
    typeof opts === "number" ? { ...defaultOpts, maxAge: opts } : { ...defaultOpts, ...(opts ?? {}) };

  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);

  if (typeof options.maxAge === "number") parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Append a refresh cookie to a Headers-like object
 * (In app-router NextResponse, use res.headers which implements Headers)
 */
export function setRefreshCookie(headers: Headers, token: string, maxAgeSec?: number) {
  const cookie = createCookie("refreshToken", token, maxAgeSec ?? 60 * 60 * 24 * 30);
  headers.append("Set-Cookie", cookie);
}

/**
 * Sign JWT access token
 * - payload: object to embed (avoid sensitive data)
 * - expiresInSeconds: default 15 minutes
 */
export function signAccessToken(payload: Record<string, unknown>, expiresInSeconds = 60 * 15): string {
  const secret = process.env.ACCESS_TOKEN_SECRET || "change_this_access_secret";
  return jwt.sign(payload as object, secret, { algorithm: "HS256", expiresIn: expiresInSeconds });
}

/**
 * Sign JWT refresh token
 * - payload: object to embed (e.g. { userId })
 * - expiresInSeconds: default 30 days
 */
export function signRefreshToken(payload: Record<string, unknown>, expiresInSeconds = 60 * 60 * 24 * 30): string {
  const secret = process.env.REFRESH_TOKEN_SECRET || "change_this_refresh_secret";
  return jwt.sign(payload as object, secret, { algorithm: "HS256", expiresIn: expiresInSeconds });
}

/**
 * Verify access token (throws if invalid)
 */
export function verifyAccessToken(token: string) {
  const secret = process.env.ACCESS_TOKEN_SECRET || "change_this_access_secret";
  return jwt.verify(token, secret);
}

/**
 * Verify refresh token (throws if invalid)
 */
export function verifyRefreshToken(token: string) {
  const secret = process.env.REFRESH_TOKEN_SECRET || "change_this_refresh_secret";
  return jwt.verify(token, secret);
}

/* -------------------------
   Prisma singleton (TS-safe)
   ------------------------- */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/* -------------------------
   Password-reset helpers
   ------------------------- */

const TOKEN_BYTES = 32;
const DEFAULT_RESET_EXP_MINUTES = Number(process.env.RESET_TOKEN_EXPIRY_MINUTES || 60);
const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

export function createSecureToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function saveResetToken(userId: string, tokenHash: string, expiresAt: Date) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  return prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

export async function findResetRecordByHashedToken(tokenHash: string) {
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash },
    include: { user: true },
  });
}

export async function deleteResetTokenById(id: string) {
  return prisma.passwordResetToken.delete({ where: { id } });
}

export async function updateUserPassword(userId: string, newHashedPassword: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { password: newHashedPassword },
  });
}

/* ------------------- Email sender (nodemailer) ------------------- */

async function getTransporter() {
  if (!process.env.SMTP_HOST) {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendResetEmail(to: string, resetUrl: string, name?: string) {
  const transporter = await getTransporter();
  const from = process.env.EMAIL_FROM || "no-reply@yourapp.com";

  const html = `
    <p>Hi ${name ?? ""},</p>
    <p>We received a request to reset your password. Click the link below to choose a new password. This link expires in ${DEFAULT_RESET_EXP_MINUTES} minutes.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>If you didn't request this, you can ignore this email.</p>
    <p>— LawCrafters</p>
  `;

  const info = await transporter.sendMail({
    from,
    to,
    subject: "Reset your password",
    html,
    text: `Reset your password: ${resetUrl}`,
  });

  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.log("Nodemailer preview URL:", preview);
  }

  return { info, preview };
}
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? process.env.ACCESS_TOKEN_SECRET;
  if (!s) throw new Error("Missing JWT secret (JWT_SECRET or ACCESS_TOKEN_SECRET)");
  return s;
}
/* ------------------- getCurrentUser helper ------------------- */
 // ensure this import remains at top of file

export async function getCurrentUser() {
  // cookies() can be async in some Next.js versions — await it
  const cookieStore = await cookies();
  const raw = cookieStore.get("auth_token")?.value;
  if (!raw) return null;

  try {
    // verify token with a guaranteed string secret
    const decoded = jwt.verify(raw, getJwtSecret()) as any;

    // Recommended: re-fetch from DB to ensure latest role and status
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, name: true, email: true, role: true },
    });

    return user;
  } catch (err) {
    // token invalid or expired
    console.error("getCurrentUser: invalid/expired token", err);
    return null;
  }
}
