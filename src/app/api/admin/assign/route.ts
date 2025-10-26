// app/api/admin/assign/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, AssignmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import sgMail from "@sendgrid/mail";

// ---------------- GLOBAL SETUP ----------------
declare global {
  // prevent multiple PrismaClient instances in dev
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma =
  global.prisma ?? new PrismaClient({ log: ["query", "info", "warn", "error"] });
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

// ---------------- SENDGRID SETUP ----------------
if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY not set - emails will fail.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL =
  process.env.FROM_EMAIL ||
  process.env.SENDGRID_FROM ||
  "no-reply@example.com";

const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.BACKEND_URL?.replace(/\/$/, "") ||
    "http://localhost:3000") + "/login";

// ---------------- EMAIL HELPER ----------------
async function sendAssignmentEmailSG({
  to,
  courseTitle,
  tempPassword,
}: {
  to: string;
  courseTitle: string;
  tempPassword?: string | null;
}) {
  const subject = tempPassword
    ? `Your LMS account & course: ${courseTitle}`
    : `New course assigned: ${courseTitle}`;

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111; line-height:1.5;">
      <h2>Hello,</h2>
      <p>You have been assigned the course <strong>${escapeHtml(
        courseTitle
      )}</strong> in the LMS.</p>

      ${
        tempPassword
          ? `
        <p>We created an account for you or set a temporary password. Use the credentials below to sign in and <strong>please change your password on first login</strong>.</p>

        <table role="presentation" style="margin:8px 0 16px; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 12px; border:1px solid #eee; background:#f9f9f9;"><strong>Email</strong></td>
            <td style="padding:8px 12px; border:1px solid #eee;">${escapeHtml(
              to
            )}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; border:1px solid #eee; background:#f9f9f9;"><strong>Temporary password</strong></td>
            <td style="padding:8px 12px; border:1px solid #eee;">${escapeHtml(
              tempPassword
            )}</td>
          </tr>
        </table>
      `
          : `
        <p>You can sign in to start the course using your existing account.</p>
      `
      }

      <p style="margin:18px 0;">
        <a href="${SITE_URL}" style="
          display:inline-block;
          background:#2563eb;
          color:white;
          padding:10px 18px;
          border-radius:6px;
          text-decoration:none;
          font-weight:600;
        ">Go to Login</a>
      </p>

      <p style="margin-top:8px; color:#555; font-size:13px;">
        If you have trouble signing in, reply to this email or contact your admin.
      </p>

      <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
      <p style="font-size:13px; color:#666;">Regards,<br/>LMS Team</p>
    </div>
  `;

  const text = tempPassword
    ? `Hello,
You have been added to the LMS and assigned the course "${courseTitle}".

Email: ${to}
Temporary password: ${tempPassword}
Login: ${SITE_URL}

Please change your password on first login.

Regards,
LMS Team`
    : `Hello,
You have been assigned the course "${courseTitle}".
Login: ${SITE_URL}

Regards,
LMS Team`;

  const msg = {
    to,
    from: { email: FROM_EMAIL, name: "LMS Team" },
    replyTo: FROM_EMAIL,
    subject,
    text,
    html,
  };

  try {
    console.log("[SENDGRID] Sending email →", to, subject);
    await sgMail.send(msg);
    console.log(`[SENDGRID] ✅ Email sent to ${to}`);
  } catch (err: any) {
    console.error(
      `[SENDGRID] ❌ Failed to send email to ${to}`,
      err?.response?.body || err?.message || err
    );
  }
}

// Helper for safe HTML escaping
function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Best-effort typed persistence of plaintext tempPassword (no raw SQL fallback)
async function persistTempPasswordIfPossible(userId: string, tempPassword: string | null) {
  if (!tempPassword) return false;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        // @ts-ignore - only works if schema has the fields; wrapped in try/catch
        tempPassword,
        // @ts-ignore
        tempPasswordIssuedAt: new Date(),
      } as any,
    });
    console.log(`[DB] Stored tempPassword for user: ${userId}`);
    return true;
  } catch (err: any) {
    console.warn(`[DB] Could not persist tempPassword for user ${userId}. Column may be missing.`, err?.message ?? err);
    return false;
  }
}

// ---------------- ASSIGN ROUTE ----------------
type AssignRequestBody = {
  orgId?: string;
  courseId: string;
  employeeIds: string[];
  employeeEmailMap?: Record<string, string | null>;
  createMissingUsers?: boolean;
  meta?: { [k: string]: any };
  skipIfAlreadyAssigned?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as AssignRequestBody;
    const assignerId = req.headers.get("x-user-id") ?? null;

    if (!body || !Array.isArray(body.employeeIds) || !body.courseId) {
      return NextResponse.json(
        { error: "Missing required fields: courseId and employeeIds" },
        { status: 400 }
      );
    }

    const {
      orgId,
      courseId,
      employeeIds,
      employeeEmailMap = {},
      createMissingUsers = false,
      skipIfAlreadyAssigned = true,
    } = body;

    // Validate course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });
    if (!course) {
      return NextResponse.json(
        { error: `Course not found: ${courseId}` },
        { status: 400 }
      );
    }
    const courseTitle = course.title ?? "Assigned Course";

    const results: any[] = [];
    let assignedCount = 0;

    for (const empId of employeeIds) {
      try {
        // --- robust user resolution & debug logging ---
        console.log(`[ASSIGN DEBUG] processing empId=${empId}`);
        let user: any = null;
        let possibleEmail =
          (employeeEmailMap?.[empId] ?? null)?.trim().toLowerCase() ?? null;

        // 1) Try as user.id
        try {
          user = await prisma.user.findUnique({
            where: { id: empId },
            select: { id: true, email: true, name: true, role: true, passwordHash: true },
          });
          if (user) console.log(`[ASSIGN DEBUG] empId ${empId} resolved as user.id=${user.id}`);
        } catch (e) {
          console.warn(`[ASSIGN DEBUG] findUnique user by id failed for ${empId}`, (e as any)?.message ?? e);
        }

        // 2) If not found and mapping provided, try by email
        if (!user && possibleEmail) {
          try {
            user = await prisma.user.findUnique({
              where: { email: possibleEmail },
              select: { id: true, email: true, name: true, role: true, passwordHash: true },
            });
            if (user) console.log(`[ASSIGN DEBUG] resolved user by provided email ${possibleEmail} -> user.id=${user.id}`);
          } catch (e) {
            console.warn(`[ASSIGN DEBUG] findUnique user by email failed for ${possibleEmail}`, (e as any)?.message ?? e);
          }
        }

        // 3) If still not found, treat empId as employee id and check employee table
        if (!user) {
          try {
            const emp = await (prisma as any).employee?.findUnique?.({
              where: { id: empId },
              select: { userId: true, email: true },
            });

            if (emp) {
              if (emp.userId) {
                try {
                  user = await prisma.user.findUnique({
                    where: { id: emp.userId },
                    select: { id: true, email: true, name: true, role: true, passwordHash: true },
                  });
                  if (user) console.log(`[ASSIGN DEBUG] resolved employee(${empId}).userId=${emp.userId}`);
                } catch (e) {
                  console.warn(`[ASSIGN DEBUG] findUnique user by employee.userId failed for ${emp.userId}`, (e as any)?.message ?? e);
                }
              }

              if (!user && emp.email && !possibleEmail) {
                possibleEmail = String(emp.email).trim().toLowerCase();
                try {
                  user = await prisma.user.findUnique({
                    where: { email: possibleEmail },
                    select: { id: true, email: true, name: true, role: true, passwordHash: true },
                  });
                  if (user) console.log(`[ASSIGN DEBUG] resolved user by employee.email ${possibleEmail} -> user.id=${user.id}`);
                } catch (e) {
                  console.warn(`[ASSIGN DEBUG] findUnique user by employee.email failed for ${possibleEmail}`, (e as any)?.message ?? e);
                }
              }
            } else {
              console.log(`[ASSIGN DEBUG] no employee record found for id=${empId}`);
            }
          } catch (e) {
            console.warn(`[ASSIGN DEBUG] error reading employee model for ${empId}`, (e as any)?.message ?? e);
          }
        }

        // 4) If still no user and createMissingUsers is false -> skip
        if (!user && !createMissingUsers) {
          results.push({
            employeeId: empId,
            assignedCreated: false,
            userCreated: false,
            error: "User not found and createMissingUsers is false or no email provided",
          });
          console.log(`[ASSIGN DEBUG] skipped empId=${empId} (no user, createMissingUsers=false)`);
          continue;
        }

        // 5) Create user if missing and allowed
        let userCreated = false;
        let createdUserId: string | null = null;
        let tempPassword: string | null = null;

        if (!user && createMissingUsers) {
          // Need an email to create user
          if (!possibleEmail) {
            results.push({
              employeeId: empId,
              assignedCreated: false,
              userCreated: false,
              error: "No email available to create user",
            });
            console.log(`[ASSIGN DEBUG] cannot create user for empId=${empId} (no email)`);
            continue;
          }

          // generate a random temporary password
          tempPassword =
            Math.random().toString(36).slice(2, 10) +
            Math.random().toString(36).slice(2, 6);
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          const newUser = await prisma.user.create({
            data: {
              email: possibleEmail,
              name: possibleEmail.split("@")[0],
              passwordHash,
              mustResetPassword: true,
              role: "LEARNER",
            },
          });

          user = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            passwordHash: newUser.passwordHash,
          };

          userCreated = true;
          createdUserId = newUser.id;

          // persist plaintext tempPassword if schema supports it (best-effort)
          try {
            await persistTempPasswordIfPossible(newUser.id, tempPassword);
          } catch (e) {
            console.warn(`[ASSIGN DEBUG] persistTempPasswordIfPossible failed for ${newUser.id}`, (e as any)?.message ?? e);
          }

          // send email with temp password
          await sendAssignmentEmailSG({
            to: possibleEmail,
            courseTitle,
            tempPassword,
          });

          console.log(`[ASSIGN DEBUG] created user ${newUser.id} for empId=${empId}`);
        }

        // 6) If user exists but has no passwordHash, set one now (regardless of createMissingUsers)
        if (user && !user.passwordHash) {
          tempPassword =
            Math.random().toString(36).slice(2, 10) +
            Math.random().toString(36).slice(2, 6);
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustResetPassword: true },
          });

          try {
            await persistTempPasswordIfPossible(user.id, tempPassword);
          } catch (e) {
            console.warn(`[ASSIGN DEBUG] persistTempPasswordIfPossible failed for ${user.id}`, (e as any)?.message ?? e);
          }

          if (user.email) {
            await sendAssignmentEmailSG({
              to: user.email,
              courseTitle,
              tempPassword,
            });
          }

          user = { ...user, passwordHash };
          console.log(`[ASSIGN DEBUG] set passwordHash for existing user ${user.id}`);
        }

        if (!user) {
          // still not resolved
          results.push({
            employeeId: empId,
            assignedCreated: false,
            userCreated: false,
            error: "User resolution failed",
          });
          console.log(`[ASSIGN DEBUG] user resolution failed for empId=${empId}`);
          continue;
        }

        // 7) prevent duplicate assignment (with logging)
        if (skipIfAlreadyAssigned) {
          try {
            const exists = await prisma.assignedCourse.findFirst({
              where: { userId: user.id, courseId },
            });
            console.log(`[ASSIGN DEBUG] exists for user=${user.id} course=${courseId}:`, !!exists);
            if (exists) {
              results.push({
                employeeId: empId,
                userId: user.id,
                assignedCreated: false,
                userCreated,
                createdUserId,
                reason: "already_assigned",
                assignedId: exists.id,
              });
              continue;
            }
          } catch (e) {
            console.error(`[ASSIGN DEBUG] exists check failed for user=${user.id} course=${courseId}`, (e as any)?.message ?? e);
            // continue to attempt create (but wrap create in try/catch)
          }
        }

        // 8) create assigned course (with try/catch)
        try {
          const assigned = await prisma.assignedCourse.create({
            data: {
              userId: user.id,
              courseId,
              orgId: orgId ?? undefined,
              assignedById: assignerId ?? undefined,
              progress: 0,
              status: "ASSIGNED" as AssignmentStatus,
              details: {},
            },
          });

          assignedCount++;

          // notify existing users (if no temp password was created we still notify as before)
          if (!userCreated && user.email && !tempPassword) {
            await sendAssignmentEmailSG({ to: user.email, courseTitle });
          }

          results.push({
            employeeId: empId,
            userId: user.id,
            assignedCreated: true,
            assignedId: assigned.id,
            userCreated,
            createdUserId,
            // include plaintext only for items we generated in this request (or updated password)
            tempPassword: userCreated || tempPassword ? tempPassword : undefined,
          });

          console.log(`[ASSIGN DEBUG] created assignment assignedId=${assigned.id} for user=${user.id}`);
        } catch (createErr) {
          console.error("[ASSIGN DEBUG] create failed for user", user?.id ?? "null", createErr);
          results.push({
            employeeId: empId,
            userId: user?.id ?? null,
            assignedCreated: false,
            error: (createErr as any)?.message ?? String(createErr),
          });
          continue;
        }
      } catch (err: any) {
        console.error("Assign error for employee:", empId, err);
        results.push({
          employeeId: empId,
          assignedCreated: false,
          error: err?.message ?? String(err),
        });
      }
    } // end for loop

    // final debug dump
    console.log("[ASSIGN] results:", JSON.stringify(results, null, 2), "assignedCount:", assignedCount);

    return NextResponse.json(
      { success: true, assignedCount, results },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Assign route error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
