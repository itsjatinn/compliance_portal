// src/app/api/admin/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");

// helper response
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

// safe read/write JSON helpers
async function readJsonSafe<T>(file: string, def: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw || "null") as T;
  } catch (e: any) {
    if (e?.code === "ENOENT") return def;
    console.error("readJsonSafe error:", file, e);
    throw e;
  }
}

async function writeJsonAtomic(file: string, data: unknown) {
  const tmp = file + ".tmp";
  await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => {});
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

type Employee = {
  id: string;
  name: string;
  email?: string;
  role?: string;
  createdAt?: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
};

function makeTempPassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Create a nodemailer transporter using SMTP env vars if provided,
 * otherwise create an Ethereal test transporter (dev).
 */
async function createNodemailerTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort ?? 587,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
  }

  // ethereal test account for local dev
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

/**
 * Send welcome email:
 * - If SENDGRID_API_KEY present -> use SendGrid API
 * - Otherwise use SMTP (if configured) or Ethereal (dev fallback)
 */
async function sendWelcomeEmail(to: string, name: string, orgName: string, tempPassword: string) {
  const from = process.env.EMAIL_FROM ?? `no-reply@${process.env.APP_HOST ?? "localhost"}`;
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const subject = `Welcome to ${orgName} — your account details`;
  const html = `
    <p>Hi ${name || "User"},</p>
    <p>Your account for <strong>${orgName}</strong> has been created.</p>
    <p><strong>Login email:</strong> ${to}<br/>
       <strong>Temporary password:</strong> <code>${tempPassword}</code></p>
    <p>Please <a href="${appUrl}/login">log in</a> and change your password immediately.</p>
    <p>If you didn't expect this email, ignore it.</p>
  `;
  const text = `Hi ${name || "User"},\n\nYour account for ${orgName} has been created.\nLogin email: ${to}\nTemporary password: ${tempPassword}\n\nPlease log in and change your password: ${appUrl}/login\n\nIf you didn't expect this email, ignore it.`;

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    // Use SendGrid
    try {
      sgMail.setApiKey(sendgridKey);

      const msg = {
        to,
        from,
        subject,
        text,
        html,
      };

      const resp = await sgMail.send(msg);

      // defensive logging for various resp shapes (array or single)
      if (Array.isArray(resp)) {
        const codes = (resp as any[]).map((r) => {
          if (r && typeof r === "object") return (r as any).statusCode ?? (r as any).status ?? "unknown";
          return "unknown";
        });
        console.log("SendGrid response status codes:", codes);
      } else {
        const status = resp && typeof resp === "object" ? (resp as any).statusCode ?? (resp as any).status ?? "unknown" : "unknown";
        console.log("SendGrid response status:", status);
      }

      return { provider: "sendgrid", ok: true };
    } catch (err: any) {
      // log the SendGrid error body (very useful)
      console.error("SendGrid error:", err?.response?.body ?? err);
      // rethrow so caller knows it failed
      throw err;
    }
  }

  // fallback to nodemailer (SMTP or Ethereal)
  const transporter = await createNodemailerTransporter();
  const info = await transporter.sendMail({ from, to, subject, text, html });
  // if ethereal will have preview URL
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("Ethereal preview URL:", preview);
  console.log("Nodemailer send info:", info.messageId ?? info);
  return { provider: "nodemailer", ok: true, preview };
}

/* ------------------- helper delete logic ------------------- */

/**
 * Delete an employee by orgId + email from data/employees_<orgId>.json
 * Returns { removed, status } where removed is the removed employee or null
 */
async function deleteEmployeeByOrgEmail(orgId: string, email: string) {
  const file = path.join(DATA_DIR, `employees_${orgId}.json`);
  const list = await readJsonSafe<Employee[]>(file, []);
  const idx = list.findIndex((e) => String(e.email || "").toLowerCase() === String(email).toLowerCase());
  if (idx === -1) return { removed: null, status: 404 };
  const removed = list.splice(idx, 1)[0];
  await writeJsonAtomic(file, list);
  return { removed, status: 200 };
}

/* ------------------- Route handlers ------------------- */

/**
 * DELETE /api/admin/employees?orgId=...&email=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const email = url.searchParams.get("email");
    if (!orgId || !email) return json({ error: "orgId & email required" }, 400);

    const { removed, status } = await deleteEmployeeByOrgEmail(orgId, email);
    if (status === 404) return json({ error: "employee not found" }, 404);

    // runtime null-check to satisfy TS and be defensive
    if (!removed) {
      console.error("admin/employees DELETE: unexpected null removed for", { orgId, email });
      return json({ error: "failed to delete employee" }, 500);
    }

    console.log(`Deleted employee ${removed.id} (${removed.email}) from org ${orgId}`);
    return json({ success: true, removed }, 200);
  } catch (err) {
    console.error("admin/employees DELETE error:", err);
    return json({ error: "failed to delete employee" }, 500);
  }
}

/**
 * POST /api/admin/employees
 * - original create behavior (orgId, name, email, role) preserved
 * - also accepts deletion fallbacks when body contains:
 *     { orgId, email, _method: "DELETE" } OR { orgId, email, action: "delete" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const maybeMethod = String(body?._method ?? "").toUpperCase();
    const maybeAction = String(body?.action ?? "").toLowerCase();

    // If client used method-override or action=delete, perform delete instead of create
    if (maybeMethod === "DELETE" || maybeAction === "delete") {
      const orgId = String(body?.orgId ?? "").trim();
      const email = String(body?.email ?? "").trim();
      if (!orgId || !email) return json({ error: "orgId & email required for delete" }, 400);

      try {
        const { removed, status } = await deleteEmployeeByOrgEmail(orgId, email);
        if (status === 404) return json({ error: "employee not found" }, 404);

        // runtime null-check to satisfy TS and be defensive
        if (!removed) {
          console.error("admin/employees POST-delete fallback: unexpected null removed for", { orgId, email });
          return json({ error: "failed to delete employee" }, 500);
        }

        console.log(`Deleted (via POST fallback) employee ${removed.id} (${removed.email}) from org ${orgId}`);
        return json({ success: true, removed }, 200);
      } catch (dErr) {
        console.error("admin/employees POST-delete fallback error:", dErr);
        return json({ error: "failed to delete employee" }, 500);
      }
    }

    // ---------- original create logic (unchanged) ----------
    const { orgId, name, email, role } = body as any;

    if (!orgId) return json({ error: "orgId required" }, 400);
    if (!name || !email) return json({ error: "name and email required" }, 400);

    // generate temporary password & hash it
    const tempPassword = makeTempPassword(10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // create employee record
    const id = `emp_${Math.random().toString(36).slice(2, 9)}`;
    const emp: Employee = {
      id,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
      passwordHash,
      mustChangePassword: true,
    };

    // persist into data/employees_<orgId>.json
    const file = path.join(DATA_DIR, `employees_${orgId}.json`);
    const list = await readJsonSafe<Employee[]>(file, []);
    list.push(emp);
    await writeJsonAtomic(file, list);

    console.log(`Added employee ${id} to org ${orgId}`);

    // Send welcome email with the plaintext temp password (only in email)
    try {
      const sendResult = await sendWelcomeEmail(email, name, `Org ${orgId}`, tempPassword);
      return json({ success: true, employee: { id: emp.id, name: emp.name, email: emp.email }, emailSent: true, sendResult }, 201);
    } catch (mailErr: any) {
      console.error("Failed to send welcome email:", mailErr?.response?.body ?? mailErr);
      return json({ success: true, employee: { id: emp.id, name: emp.name, email: emp.email }, emailSent: false, emailError: String(mailErr?.message ?? mailErr) }, 201);
    }
  } catch (err) {
    console.error("admin/employees POST error:", err);
    return json({ error: "failed to add employee" }, 500);
  }
}
