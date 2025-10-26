// app/api/admin/orgs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
// Adjust this path to match where your prisma client is exported from in your repo.
import prisma from "../../../../../lib/prisma";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = params?.id;
  if (!orgId) {
    return NextResponse.json({ error: "org id required" }, { status: 400 });
  }

  try {
    // Ensure organization exists
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Prepare a list of deleteMany operations for known models that use orgId.
    // Order matters if you have foreign keys between these models.
    // These model names are the Prisma client property names (camelCased).
    const deletes: Array<Promise<any> | { modelName: string; op: Promise<any> }> = [];

    // Helper to push deleteMany for a model if the client supports it.
    const maybePushDeleteMany = (modelName: string, where: any = { orgId }) => {
      const model = (prisma as any)[modelName];
      if (model && typeof model.deleteMany === "function") {
        // push the promise holder so we can run them inside $transaction later
        deletes.push({ modelName, op: model.deleteMany({ where }) });
      }
    };

    // Known models that reference orgId in your schema:
    maybePushDeleteMany("assignedCourse"); // AssignedCourse
    maybePushDeleteMany("assignedCourses"); // in case different naming exists
    maybePushDeleteMany("certificate"); // Certificate
    maybePushDeleteMany("certificates");
    maybePushDeleteMany("progress"); // Progress
    maybePushDeleteMany("progresses");
    // user rows: we remove users associated with the org (only if your business logic allows hard-delete)
    maybePushDeleteMany("user"); // User
    maybePushDeleteMany("users");

    // If you have other org-scoped models, add them here, e.g.
    // maybePushDeleteMany("someOtherModel");

    // Execute deletes in a transaction and collect counts.
    const deleteOps = deletes.map(d => (d as any).op);
    const results = deleteOps.length > 0 ? await prisma.$transaction(deleteOps) : [];

    // Map results to counts by model name for reporting
    const deletedByModel: Record<string, number> = {};
    let totalDeleted = 0;
    for (let i = 0; i < deletes.length; i++) {
      const descriptor = deletes[i] as any;
      const modelName = descriptor.modelName;
      const res = results[i];
      const count = typeof res?.count === "number" ? res.count : 0;
      deletedByModel[modelName] = count;
      totalDeleted += count;
    }

    // Finally delete the organization itself. If you already have ON DELETE CASCADE
    // for certain relations at DB-level, this delete may also have removed dependent rows;
    // in that case some counts above may be zero — but deleting here is still correct.
    await prisma.organization.delete({ where: { id: orgId } });

    return NextResponse.json({
      success: true,
      orgIdDeleted: orgId,
      deletedAssignmentsAndRelatedCounts: deletedByModel,
      totalDeletedRowsBeforeOrgDelete: totalDeleted,
    });
  } catch (err: any) {
    console.error(`DELETE /api/admin/orgs/${params?.id} error:`, err);
    // If the DB complains about foreign key constraints it means some relation wasn't removed;
    // advise running migrations to set ON DELETE CASCADE or add the missing model to the deletion list.
    return NextResponse.json(
      {
        error: "Failed to delete organization",
        message: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
