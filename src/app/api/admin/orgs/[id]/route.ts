// app/api/admin/orgs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "../../../../../lib/prisma";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = params?.id;
  if (!orgId) {
    return NextResponse.json({ error: "org id required" }, { status: 400 });
  }

  try {
    // 1) ensure organization exists
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 2) collect user ids that belong to this org (may be empty)
    const users = await prisma.user.findMany({ where: { orgId }, select: { id: true } });
    const userIds = users.map(u => u.id);

    // Prepare ops typed as Prisma.PrismaPromise<any>[]
    const ops: Prisma.PrismaPromise<any>[] = [];

    // AssignedCourse has orgId -> delete by orgId
    ops.push(prisma.assignedCourse.deleteMany({ where: { orgId } }));

    // Certificates that belong to org
    ops.push(prisma.certificate.deleteMany({ where: { orgId } }));

    // If there are users, delete user-scoped records first to avoid FK issues:
    if (userIds.length > 0) {
      // Progress rows linked to users
      ops.push(prisma.progress.deleteMany({ where: { userId: { in: userIds } } }));

      // PasswordResetToken linked to users
      ops.push(prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } }));

      // add other per-user deletes here if needed
    } else {
      // To keep mapping predictable, push "no-op" prisma deleteMany with an impossible filter returning count 0.
      // This keeps results array positions consistent for later mapping.
      // We use a Prisma call so its type remains PrismaPromise.
      ops.push(prisma.progress.deleteMany({ where: { userId: { in: ["__none__"] } } }));
      ops.push(prisma.passwordResetToken.deleteMany({ where: { userId: { in: ["__none__"] } } }));
    }

    // Delete users themselves (by orgId)
    ops.push(prisma.user.deleteMany({ where: { orgId } }));

    // Execute the deletes in a single transaction (child deletes + users)
    const results = await prisma.$transaction(ops);

    // Build friendly map of counts (match order of ops added)
    const deletedByModel: Record<string, number> = {};
    let idx = 0;

    deletedByModel["assignedCourse"] = typeof results[idx]?.count === "number" ? results[idx].count : 0;
    idx++;
    deletedByModel["certificate"] = typeof results[idx]?.count === "number" ? results[idx].count : 0;
    idx++;

    // progress & passwordResetToken entries (either real deletes or no-op deletes)
    deletedByModel["progress"] = typeof results[idx]?.count === "number" ? results[idx].count : 0;
    idx++;
    deletedByModel["passwordResetToken"] = typeof results[idx]?.count === "number" ? results[idx].count : 0;
    idx++;

    deletedByModel["user"] = typeof results[idx]?.count === "number" ? results[idx].count : 0;

    const totalDeletedBeforeOrg = Object.values(deletedByModel).reduce((s, v) => s + (v ?? 0), 0);

    // 3) finally delete organization
    await prisma.organization.delete({ where: { id: orgId } });

    return NextResponse.json({
      success: true,
      orgIdDeleted: orgId,
      deletedCounts: deletedByModel,
      totalDeletedRowsBeforeOrgDelete: totalDeletedBeforeOrg,
      note:
        "Deleted assigned courses and certificates by orgId; deleted user-scoped data (progress, tokens) by userId; then deleted users and finally the organization. Courses are global and were not deleted."
    });
  } catch (err: any) {
    console.error(`DELETE /api/admin/orgs/${orgId} error:`, err);
    return NextResponse.json(
      {
        error: "Failed to delete organization",
        message: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
