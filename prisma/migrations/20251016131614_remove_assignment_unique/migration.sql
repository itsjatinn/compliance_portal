/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,courseId,orgId]` on the table `Certificate` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."AssignedCourse" DROP CONSTRAINT "AssignedCourse_assignedById_fkey";

-- DropIndex
DROP INDEX "public"."AssignedCourse_courseId_idx";

-- DropIndex
DROP INDEX "public"."Certificate_userId_courseId_key";

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userId_courseId_orgId_key" ON "Certificate"("userId", "courseId", "orgId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
