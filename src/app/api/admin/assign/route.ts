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
        <p>We created an account for you. Use the credentials below to sign in and <strong>please change your password on first login</strong>.</p>

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
        // 1️⃣ find user by ID or email
        let user =
          (await prisma.user.findUnique({
            where: { id: empId },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              passwordHash: true,
            },
          })) || null;

        const possibleEmail =
          (employeeEmailMap?.[empId] ?? null)?.trim().toLowerCase() ?? null;
        if (!user && possibleEmail) {
          user =
            (await prisma.user.findUnique({
              where: { email: possibleEmail },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                passwordHash: true,
              },
            })) || null;
        }

        // 2️⃣ fallback: employee model (if exists)
        if (!user) {
          try {
            const emp = await (prisma as any).employee?.findUnique?.({
              where: { id: empId },
              select: { userId: true, email: true },
            });
            if (emp?.userId) {
              user =
                (await prisma.user.findUnique({
                  where: { id: emp.userId },
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    passwordHash: true,
                  },
                })) || null;
            } else if (emp?.email && !possibleEmail) {
              const eEmail = String(emp.email).trim().toLowerCase();
              user =
                (await prisma.user.findUnique({
                  where: { email: eEmail },
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    passwordHash: true,
                  },
                })) || null;
            }
          } catch {
            // silently ignore
          }
        }

        // 3️⃣ create user if missing
        let userCreated = false;
        let createdUserId: string | null = null;
        let tempPassword: string | null = null;

        if (!user && createMissingUsers) {
          if (!possibleEmail) {
            results.push({
              employeeId: empId,
              assignedCreated: false,
              userCreated: false,
              error: "No email available to create user",
            });
            continue;
          }

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

          await sendAssignmentEmailSG({
            to: possibleEmail,
            courseTitle,
            tempPassword,
          });
        }

        // 4️⃣ assign temp password if user has none
        if (user && !user.passwordHash && createMissingUsers) {
          tempPassword =
            Math.random().toString(36).slice(2, 10) +
            Math.random().toString(36).slice(2, 6);
          const passwordHash = await bcrypt.hash(tempPassword, 10);

          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustResetPassword: true },
          });

          user = { ...user, passwordHash };

          if (user.email) {
            await sendAssignmentEmailSG({
              to: user.email,
              courseTitle,
              tempPassword,
            });
          }
        }

        if (!user) {
          results.push({
            employeeId: empId,
            assignedCreated: false,
            userCreated: false,
            error:
              "User not found and createMissingUsers is false or no email provided",
          });
          continue;
        }

        // 5️⃣ prevent duplicate assignment
        if (skipIfAlreadyAssigned) {
          const exists = await prisma.assignedCourse.findFirst({
            where: { userId: user.id, courseId },
          });
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
        }

        // 6️⃣ create assigned course
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

        // 7️⃣ notify existing users (no temp password)
        if (!userCreated && user.email) {
          await sendAssignmentEmailSG({ to: user.email, courseTitle });
        }

        results.push({
          employeeId: empId,
          userId: user.id,
          assignedCreated: true,
          assignedId: assigned.id,
          userCreated,
          createdUserId,
          tempPassword: userCreated || tempPassword ? tempPassword : undefined,
        });
      } catch (err: any) {
        console.error("Assign error for employee:", empId, err);
        results.push({
          employeeId: empId,
          assignedCreated: false,
          error: err?.message ?? String(err),
        });
      }
    }

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
