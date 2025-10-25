/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Course` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AssignedCourse" ALTER COLUMN "progress" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "updatedAt",
ALTER COLUMN "image" DROP DEFAULT;
