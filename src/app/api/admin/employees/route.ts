// src/app/api/admin/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import prisma from "../../../../lib/prisma"; // adjust path if needed

export const runtime = "nodejs";

/* ---------------- helpers ---------------- */

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

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

      const msg: any = {
        to,
        from,
        subject,
        text,
        html,
      };

      const resp = await sgMail.send(msg);

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
      console.error("SendGrid error:", err?.response?.body ?? err);
      throw err;
    }
  }

  // fallback to nodemailer (SMTP or Ethereal)
  const transporter = await createNodemailerTransporter();
  const info = await transporter.sendMail({ from, to, subject, text, html });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log("Ethereal preview URL:", preview);
  console.log("Nodemailer send info:", info.messageId ?? info);
  return { provider: "nodemailer", ok: true, preview };
}

/* ------------------- Route handlers ------------------- */

/**
 * DELETE /api/admin/employees?orgId=...&email=...
 * Deletes user(s) by email within an organization scope (if orgId supplied we filter by org existence)
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    const email = url.searchParams.get("email");
    if (!email) return json({ error: "email required" }, 400);

    // Optionally verify org exists if orgId provided
    if (orgId) {
      const org = await prisma.organization.findUnique({ where: { id: String(orgId) } });
      if (!org) return json({ error: "organization_not_found" }, 404);
    }

    // Note: your current User model has no orgId column. We delete by email only.
    const result = await prisma.user.deleteMany({
      where: {
        email: { equals: String(email).toLowerCase(), mode: "insensitive" },
      },
    });

    if (result.count === 0) return json({ error: "employee not found" }, 404);

    console.log(`Deleted ${result.count} user(s) with email ${email}`);
    return json({ success: true, removedCount: result.count }, 200);
  } catch (err) {
    console.error("admin/employees DELETE error:", err);
    return json({ error: "failed to delete employee", message: String((err as any)?.message ?? err) }, 500);
  }
}

/**
 * POST /api/admin/employees
 * - Create a user in the DB (User model)
 * - Accepts delete fallback when body contains { orgId, email, _method: "DELETE" } or action: "delete"
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const maybeMethod = String(body?._method ?? "").toUpperCase();
    const maybeAction = String(body?.action ?? "").toLowerCase();

    // If client used method-override or action=delete, perform delete instead of create
    if (maybeMethod === "DELETE" || maybeAction === "delete") {
      const orgId = String(body?.orgId ?? "").trim();
      const email = String(body?.email ?? "").trim();
      if (!email) return json({ error: "email required for delete" }, 400);

      // Optionally verify org exists if provided
      if (orgId) {
        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return json({ error: "organization_not_found" }, 404);
      }

      try {
        const deleted = await prisma.user.deleteMany({
          where: { email: { equals: email.toLowerCase(), mode: "insensitive" } },
        });
        if (deleted.count === 0) return json({ error: "employee not found" }, 404);
        return json({ success: true, removedCount: deleted.count }, 200);
      } catch (dErr) {
        console.error("admin/employees POST-delete fallback error:", dErr);
        return json({ error: "failed to delete employee" }, 500);
      }
    }

    // ---------- create employee ----------
    const { orgId, name, email, role } = body ?? {};
    if (!name || !email) return json({ error: "name and email required" }, 400);

    // If orgId provided, verify org exists (but we do NOT write orgId on User because schema lacks it)
    let orgName = `Org ${orgId ?? ""}`;
    if (orgId) {
      const org = await prisma.organization.findUnique({ where: { id: String(orgId) } });
      if (!org) {
        return json({ error: "organization_not_found", message: "Organization with provided orgId not found" }, 400);
      }
      orgName = org.name ?? orgName;
    }

    // generate temporary password & hash it
    const tempPassword = makeTempPassword(10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    try {
      const created = await prisma.user.create({
        data: {
          email: String(email).toLowerCase(),
          name: String(name),
          passwordHash,
          mustResetPassword: true,
          role: role ? (role as any) : undefined, // expects enum values ADMIN/ORG_ADMIN/LEARNER
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          mustResetPassword: true,
        },
      });

      console.log(`Added user ${created.id} (${created.email})`);

      // Send welcome email; if it fails, still return success but indicate email failure
      try {
        const sendResult = await sendWelcomeEmail(created.email, created.name ?? "", orgName, tempPassword);
        return json({ success: true, employee: created, emailSent: true, sendResult }, 201);
      } catch (mailErr: any) {
        console.error("Failed to send welcome email:", mailErr?.response?.body ?? mailErr);
        return json({
          success: true,
          employee: created,
          emailSent: false,
          emailError: String(mailErr?.message ?? mailErr),
        }, 201);
      }
    } catch (dbErr: any) {
      console.error("Prisma create user error:", dbErr);

      // Handle unique constraint (duplicate email)
      if (dbErr?.code === "P2002") {
        const target = dbErr?.meta?.target ?? [];
        return json({ error: "duplicate", target, message: dbErr.message }, 409);
      }

      return json({ error: "failed_to_add_employee", message: dbErr?.message ?? String(dbErr) }, 500);
    }
  } catch (err) {
    console.error("admin/employees POST error:", err);
    return json({ error: "failed to add employee", message: String((err as any)?.message ?? err) }, 500);
  }
}
