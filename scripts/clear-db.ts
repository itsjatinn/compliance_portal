// scripts/clear-entries.ts
import prisma from "../src/lib/prisma";

async function clearAllEntries() {
  console.log("🧹 Starting DB cleanup (delete entries only).");

  try {
    // Delete in order from children -> parents to avoid FK constraint issues.
    // This order is based on your schema:
    // PasswordResetToken -> AssignedCourse -> Certificate -> Progress -> Lesson -> Course -> Organization -> User
    // We use optional chaining in case any model name differs in your client for some reason.

    const deleted = {} as Record<string, number | string>;

    try {
      const res = await (prisma as any).passwordResetToken?.deleteMany?.();
      deleted.passwordResetToken = res?.count ?? "skipped";
      console.log(`✅ passwordResetToken: ${res?.count ?? "skipped"}`);
    } catch (e) {
      console.warn("⚠️ passwordResetToken delete failed:", (e as any)?.message ?? e);
    }

    try {
      const res = await (prisma as any).assignedCourse?.deleteMany?.();
      deleted.assignedCourse = res?.count ?? "skipped";
      console.log(`✅ assignedCourse: ${res?.count ?? "skipped"}`);
    } catch (e) {
      console.warn("⚠️ assignedCourse delete failed:", (e as any)?.message ?? e);
    }

    try {
      const res = await (prisma as any).certificate?.deleteMany?.();
      deleted.certificate = res?.count ?? "skipped";
      console.log(`✅ certificate: ${res?.count ?? "skipped"}`);
    } catch (e) {
      console.warn("⚠️ certificate delete failed:", (e as any)?.message ?? e);
    }

    try {
      const res = await (prisma as any).progress?.deleteMany?.();
      deleted.progress = res?.count ?? "skipped";
      console.log(`✅ progress: ${res?.count ?? "skipped"}`);
    } catch (e) {
      console.warn("⚠️ progress delete failed:", (e as any)?.message ?? e);
    }

    try {
      const res = await (prisma as any).lesson?.deleteMany?.();
      deleted.lesson = res?.count ?? "skipped";
      console.log(`✅ lesson: ${res?.count ?? "skipped"}`);
    } catch (e) {
      console.warn("⚠️ lesson delete failed:", (e as any)?.message ?? e);
    }

    try {
      const res = await (prisma as any).course?.deleteMany?.();
      deleted.course = res?.count ?? "skipped";
      console.log(`✅ course: ${res?.count ?? "skipped"}`);
    } catch (e) {
      console.warn("⚠️ course delete failed:", (e as any)?.message ?? e);
    }

    try {
      const res = await (prisma as any).organization?.deleteMany?.();
      deleted.organization = res?.count ?? "skipped";
      console.log(`✅ organization: ${res?.count ?? "skipped"}`);
    } catch (e) {
      console.warn("⚠️ organization delete failed:", (e as any)?.message ?? e);
    }

    try {
      const res = await (prisma as any).user?.deleteMany?.();
      deleted.user = res?.count ?? "skipped";
      console.log(`✅ user: ${res?.count ?? "skipped"}`);
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
