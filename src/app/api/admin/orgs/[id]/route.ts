// app/api/admin/orgs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
// Adjust this import path to match your prisma client export (some files use "@/lib/prisma" or "../../../../lib/prisma")
import prisma from "../../../../../lib/prisma";

export const runtime = "nodejs";

const POSSIBLE_ASSIGNMENT_MODEL_NAMES = [
  // Common variants observed in your repo
  "assignedCourse",
  "assigned_course",
  "AssignedCourse",
  "courseAssignment",
  "course_assignment",
  "CourseAssignment",
  "assignedCourses",
  "assigned_courses",
];

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const orgId = params?.id;
  if (!orgId) {
    return NextResponse.json({ error: "org id required" }, { status: 400 });
  }

  try {
    // ensure org exists
    const org = await (prisma as any).organization?.findUnique?.({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // We'll attempt to delete assignment rows from multiple candidate models.
    // Use sequential calls (safer for heterogeneous schemas). We gather counts for reporting.
    let totalDeletedAssignments = 0;
    const deletedByModel: Record<string, number> = {};

    for (const modelName of POSSIBLE_ASSIGNMENT_MODEL_NAMES) {
      try {
        const model = (prisma as any)[modelName];
        if (model && typeof model.deleteMany === "function") {
          // call deleteMany({ where: { orgId } })
          const res = await model.deleteMany({ where: { orgId } });
          const count = typeof res?.count === "number" ? res.count : res?.length ?? 0;
          if (count > 0) {
            deletedByModel[modelName] = count;
            totalDeletedAssignments += count;
          }
        }
      } catch (e) {
        // ignore model-specific errors (if the model exists but shape differs), but log to server console
        // This is non-fatal: we still try other models and proceed with deleting the organization.
        console.warn(`Attempt to delete assignments on model '${modelName}' failed (continuing):`, (e as any)?.message ?? e);
      }
    }

    // If you prefer DB-level cascade instead of manual deletes you could migrate schema.prisma with `onDelete: Cascade`.
    // Here we perform an explicit delete of the organization.
    await (prisma as any).organization.delete({ where: { id: orgId } });

    return NextResponse.json({
      success: true,
      deletedAssignmentsCount: totalDeletedAssignments,
      deletedByModel,
      orgIdDeleted: orgId,
    });
  } catch (err: any) {
    console.error("DELETE /api/admin/orgs/[id] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete organization" },
      { status: 500 }
    );
  }
}
