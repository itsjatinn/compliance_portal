// app/api/admin/assignments/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { prisma } from "../../../../lib/prisma";
import { readJson, writeJson } from "../../../../lib/fs";
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const ASSIGNMENTS_FILE = path.join(DATA_DIR, "assignments.json");

type AssignmentMeta = {
  id: string;
  orgId?: string;
  courseId: string;
  courseTitle?: string;
  employeeIds?: string[];
  employeeEmails?: string[];
  createdAt: string;
};

function errMsg(e: unknown) {
  try {
    if (!e) return String(e);
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message;
    // @ts-ignore
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

async function createTransporterIfNeeded() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (host && user && pass) {
    return nodemailer.createTransport({ host, port: port ?? 587, secure: port === 465, auth: { user, pass } });
  }
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

async function sendAssignmentEmail(to: string, subject: string, text: string) {
  const from = process.env.EMAIL_FROM ?? `no-reply@${process.env.APP_HOST ?? "localhost"}`;
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({ to, from, subject, text });
    return { provider: "sendgrid" };
  } else {
    const transporter = await createTransporterIfNeeded();
    const info = await transporter.sendMail({ from, to, subject, text });
    return { provider: "nodemailer", info };
  }
}

/**
 * GET - return assignments.json contents
 */
export async function GET() {
  try {
    const assignments = await readJson<AssignmentMeta[]>(ASSIGNMENTS_FILE, []);
    return NextResponse.json(assignments);
  } catch (err) {
    console.error("Failed to read assignments.json:", errMsg(err));
    return NextResponse.json({ error: "Failed to read assignments" }, { status: 500 });
  }
}

/**
 * POST - create assignments and write assignments.json
 * body: { orgId?, orgName?, courseId, courseTitle?, employeeIds?, employeeEmails?, createMissingUsers? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId: string | undefined = body?.orgId ? String(body.orgId) : undefined;
    const orgName: string | undefined = body?.orgName ? String(body.orgName) : undefined;
    const courseId = String(body?.courseId ?? "");
    const courseTitle = body?.courseTitle ? String(body.courseTitle) : undefined;
    const createMissingUsers = !!body?.createMissingUsers;

    const employeeIds: string[] = Array.isArray(body?.employeeIds) ? body.employeeIds.map(String) : [];
    const employeeEmails: string[] = Array.isArray(body?.employeeEmails) ? body.employeeEmails.map(String) : [];

    if (!courseId || (employeeIds.length === 0 && employeeEmails.length === 0)) {
      return NextResponse.json({ error: "courseId and employeeIds/employeeEmails required" }, { status: 400 });
    }

    // ensure data dir exists
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not ensure data dir:", errMsg(e));
    }

    // load file-backed employees for org if present
    let fileEmployees: any[] = [];
    if (orgId) {
      const empFile = path.join(DATA_DIR, `employees_${orgId}.json`);
      try {
        fileEmployees = await readJson<any[]>(empFile, []);
      } catch (e) {
        fileEmployees = [];
      }
    }

    // unify requested targets (dedupe)
    const requestedList = Array.from(new Set([...employeeIds, ...employeeEmails]));

    // assignment metadata
    const assignmentMeta: AssignmentMeta = {
      id: nanoid(),
      orgId,
      courseId,
      courseTitle,
      employeeIds,
      employeeEmails,
      createdAt: new Date().toISOString(),
    };

    const results: any[] = [];
    let assignedCount = 0;

    // make sure Course exists (auto-create if possible)
    let courseInDb: any = null;
    try {
      courseInDb = await prisma.course.findUnique({ where: { id: courseId } }).catch(() => null);
      if (!courseInDb && courseTitle) {
        courseInDb = await prisma.course.create({ data: { id: courseId, title: courseTitle } });
        console.log("Auto-created Course:", courseId);
      }
    } catch (e) {
      console.error("Error ensuring course:", errMsg(e));
      courseInDb = null;
    }

    // ensure organization exists if orgId provided (auto-create using orgName if present)
    let orgInDb: any = null;
    if (orgId) {
      try {
        orgInDb = await prisma.organization.findUnique({ where: { id: orgId } }).catch(() => null);
        if (!orgInDb) {
          const nameForCreate = orgName ?? `Org ${orgId}`;
          try {
            orgInDb = await prisma.organization.create({ data: { id: orgId, name: nameForCreate } });
            console.log("Auto-created Organization:", orgInDb.id);
          } catch (createOrgErr) {
            console.warn("Failed to auto-create Organization (will proceed without org relation):", errMsg(createOrgErr));
            orgInDb = null;
          }
        }
      } catch (e) {
        console.error("Error ensuring organization:", errMsg(e));
        orgInDb = null;
      }
    }

    const headerAssignedBy = req.headers.get("x-user-id") ?? undefined;

    // loop each requested id/email
    for (const requestedId of requestedList) {
      let user: any = null;
      let createdUser = false;
      let createdPassword = false;
      let plainPassword: string | null = null;
      let savedToPrisma = false;
      let assignedCreated = false;
      let emailSent = false;
      let emailError: string | null = null;

      try {
        // try file record first (if org provided)
        let fileRecord: any | undefined = undefined;
        if (orgId && fileEmployees && fileEmployees.length) {
          fileRecord = fileEmployees.find(
            (f) =>
              f.id === requestedId ||
              String(f.id) === String(requestedId) ||
              (f.email && String(f.email).toLowerCase() === String(requestedId).toLowerCase())
          );
        }

        // find user in DB by email or id
        if (/\S+@\S+\.\S+/.test(String(requestedId))) {
          user = await prisma.user.findUnique({ where: { email: String(requestedId).toLowerCase() } }).catch(() => null);
        }
        if (!user) {
          user = await prisma.user.findUnique({ where: { id: String(requestedId) } }).catch(() => null);
        }

        // if not found and fileRecord present, try by fileRecord.email
        if (!user && fileRecord?.email) {
          user = await prisma.user.findUnique({ where: { email: String(fileRecord.email).toLowerCase() } }).catch(() => null);
        }

        // if still not found and fileRecord.email && createMissingUsers => create user
        if (!user && fileRecord?.email && createMissingUsers) {
          try {
            plainPassword = plainPassword ?? Math.random().toString(36).slice(-10);
            const hashed = await bcrypt.hash(plainPassword, 10);
            user = await prisma.user.create({
              data: {
                email: String(fileRecord.email).toLowerCase(),
                name: fileRecord.name ?? undefined,
                passwordHash: hashed, // note: `password` field in Prisma schema holds hashed password
                mustResetPassword: true,
              },
            });
            createdUser = true;
            createdPassword = true;
            savedToPrisma = true;
            console.log(`Created user from fileRecord: ${user.email}`);
          } catch (e) {
            console.error("Prisma create user from fileRecord failed:", errMsg(e));
            user = null;
          }
        }

        // if still not found and requestedId looks like email + createMissingUsers => create
        if (!user && /\S+@\S+\.\S+/.test(String(requestedId)) && createMissingUsers) {
          try {
            plainPassword = plainPassword ?? Math.random().toString(36).slice(-10);
            const hashed = await bcrypt.hash(plainPassword, 10);
            user = await prisma.user.create({
              data: {
                email: String(requestedId).toLowerCase(),
                passwordHash: hashed,
                mustResetPassword: true,
              },
            });
            createdUser = true;
            createdPassword = true;
            savedToPrisma = true;
            console.log(`Created user by email: ${user.email}`);
          } catch (e) {
            console.error("Prisma create user by email failed:", errMsg(e));
            user = null;
          }
        }

        // fallback to file-only representation
        if (!user) {
          if (fileRecord) {
            user = { id: fileRecord.id, email: fileRecord.email ?? null, name: fileRecord.name ?? null, _fileOnly: true };
          } else {
            user = { id: requestedId, email: /\S+@\S+\.\S+/.test(String(requestedId)) ? requestedId : null, name: null, _fileOnly: true };
          }
        }

        // Create AssignedCourse row for DB users when course exists.
        try {
          if (user?._fileOnly) {
            console.info(`Skipping AssignedCourse: file-only user for requestedId=${requestedId}`);
          } else if (!courseInDb) {
            console.info(`Skipping AssignedCourse: course ${courseId} missing in DB`);
          } else {
            // Create a new AssignedCourse row always (allow multiple assignments)
            const createData: any = {
              userId: String(user.id),
              courseId: String(courseId),
              progress: 0,
              status: "ASSIGNED",
              details: {},
            };
            if (orgInDb) createData.orgId = orgInDb.id;
            if (headerAssignedBy) createData.assignedById = headerAssignedBy;

            const createdAssigned = await prisma.assignedCourse.create({ data: createData });
            assignedCreated = true;
            assignedCount++;
            savedToPrisma = true;
            console.log("AssignedCourse created:", createdAssigned.id, "user=", user.id, "course=", courseId, "orgId=", orgInDb?.id ?? null);
          }
        } catch (dbErr) {
          console.error("Error creating AssignedCourse:", errMsg(dbErr));
        }

        // merge DB user info & password (hashed) back to fileEmployees if orgId provided
        if (orgId && fileEmployees) {
          try {
            const idx = fileEmployees.findIndex(
              (f) =>
                String(f.id) === String(user.id) ||
                (f.email && user.email && String(f.email).toLowerCase() === String(user.email).toLowerCase())
            );

            // prefer storing hashed password for file; use user.password if present (it's hashed in DB)
            const hashedForFile = user?.password ?? (plainPassword ? await bcrypt.hash(plainPassword, 10) : null);

            if (idx >= 0) {
              fileEmployees[idx] = {
                ...fileEmployees[idx],
                id: String(user.id),
                email: user.email ?? fileEmployees[idx].email,
                name: user.name ?? fileEmployees[idx].name,
                passwordHash: hashedForFile ?? fileEmployees[idx].passwordHash ?? null,
                updatedAt: new Date().toISOString(),
              };
            } else {
              if (user.id || user.email) {
                fileEmployees.push({
                  id: String(user.id),
                  email: user.email ?? null,
                  name: user.name ?? null,
                  passwordHash: hashedForFile ?? null,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          } catch (mergeErr) {
            console.warn("Failed to merge into fileEmployees:", errMsg(mergeErr));
          }
        }

        // email temp password if generated for a real DB user with email
        if (plainPassword && user?.email && !user?._fileOnly) {
          const subject = `You've been assigned to ${courseTitle ?? courseId}`;
          const text = `Hi ${user?.name ?? ""},\n\nYou have been assigned the course "${courseTitle ?? courseId}".\n\nLogin: ${user.email}\nTemporary password: ${plainPassword}\n\nPlease log in and change your password.`;
          try {
            await sendAssignmentEmail(user.email, subject, text);
            emailSent = true;
          } catch (mailErr) {
            emailError = errMsg(mailErr);
            console.error("Failed to send assignment email:", emailError);
          }
        }

        results.push({
          requestedId,
          userId: user?.id ?? null,
          email: user?.email ?? null,
          name: user?.name ?? null,
          createdUser,
          createdPassword,
          savedToPrisma,
          assignedCreated,
          emailSent,
          emailError,
          note: user?._fileOnly ? "file-only fallback (not created in DB)" : null,
        });
      } catch (recipientErr) {
        console.error("Error processing requestedId", requestedId, recipientErr);
        results.push({ requestedId, error: errMsg(recipientErr) });
      }
    } // end loop

    // write updated fileEmployees if orgId provided
    if (orgId) {
      try {
        const empFilePath = path.join(DATA_DIR, `employees_${orgId}.json`);
        await writeJson(empFilePath, fileEmployees);
      } catch (e) {
        console.warn("Failed to write employees file:", errMsg(e));
      }
    }

    // append assignment metadata to assignments.json
    try {
      const existing = await readJson<AssignmentMeta[]>(ASSIGNMENTS_FILE, []);
      existing.unshift(assignmentMeta);
      await writeJson(ASSIGNMENTS_FILE, existing);
    } catch (e) {
      console.error("Failed to write assignments.json:", errMsg(e));
    }

    return NextResponse.json({ success: true, assignment: assignmentMeta, results, assignedCount }, { status: 201 });
  } catch (err) {
    console.error("assign route error:", errMsg(err));
    return NextResponse.json({ error: "failed to assign", details: errMsg(err) }, { status: 500 });
  }
}
