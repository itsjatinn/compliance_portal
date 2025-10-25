/*
  Warnings:

  - Added the required column `updatedAt` to the `AssignedCourse` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "AssignedCourse" ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "AssignedCourse_userId_idx" ON "AssignedCourse"("userId");

-- CreateIndex
CREATE INDEX "AssignedCourse_courseId_idx" ON "AssignedCourse"("courseId");

-- CreateIndex
CREATE INDEX "AssignedCourse_courseId_orgId_idx" ON "AssignedCourse"("courseId", "orgId");

-- AddForeignKey
ALTER TABLE "AssignedCourse" ADD CONSTRAINT "AssignedCourse_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedCourse" ADD CONSTRAINT "AssignedCourse_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
