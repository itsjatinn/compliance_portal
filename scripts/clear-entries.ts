/**
 * scripts/clear-entries.ts
 * Deletes rows from your DB while preserving schema/migrations.
 * Run: npx tsx scripts/clear-entries.ts
 */

import prisma from "../src/lib/prisma"; // from scripts/ -> up one -> src/lib/prisma.ts

async function clearAllEntries() {
  console.log("🧹 Starting DB cleanup (delete entries only).");

  const deleted: Record<string, number | string> = {};

  try {
    // Order is important because of FK constraints (children first).
    try {
      const r = await (prisma as any).passwordResetToken?.deleteMany?.();
      deleted.passwordResetToken = r?.count ?? 0;
      console.log(`✅ passwordResetToken: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ passwordResetToken delete failed:", (e as any)?.message ?? e);
    }

    try {
      const r = await (prisma as any).assignedCourse?.deleteMany?.();
      deleted.assignedCourse = r?.count ?? 0;
      console.log(`✅ assignedCourse: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ assignedCourse delete failed:", (e as any)?.message ?? e);
    }

    try {
      const r = await (prisma as any).certificate?.deleteMany?.();
      deleted.certificate = r?.count ?? 0;
      console.log(`✅ certificate: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ certificate delete failed:", (e as any)?.message ?? e);
    }

    try {
      const r = await (prisma as any).progress?.deleteMany?.();
      deleted.progress = r?.count ?? 0;
      console.log(`✅ progress: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ progress delete failed:", (e as any)?.message ?? e);
    }

    try {
      const r = await (prisma as any).lesson?.deleteMany?.();
      deleted.lesson = r?.count ?? 0;
      console.log(`✅ lesson: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ lesson delete failed:", (e as any)?.message ?? e);
    }

    try {
      const r = await (prisma as any).course?.deleteMany?.();
      deleted.course = r?.count ?? 0;
      console.log(`✅ course: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ course delete failed:", (e as any)?.message ?? e);
    }

    try {
      const r = await (prisma as any).organization?.deleteMany?.();
      deleted.organization = r?.count ?? 0;
      console.log(`✅ organization: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ organization delete failed:", (e as any)?.message ?? e);
    }

    try {
      const r = await (prisma as any).user?.deleteMany?.();
      deleted.user = r?.count ?? 0;
      console.log(`✅ user: ${r?.count ?? 0}`);
    } catch (e) {
      console.warn("⚠️ user delete failed:", (e as any)?.message ?? e);
    }

    console.log("🎉 Done. Summary:", deleted);
  } catch (err) {
    console.error("❌ Unexpected error clearing DB entries:", err);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllEntries()
  .then(() => {
    console.log("Script finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  });
