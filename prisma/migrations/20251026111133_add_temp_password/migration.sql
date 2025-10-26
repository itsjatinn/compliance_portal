-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tempPassword" TEXT,
ADD COLUMN     "tempPasswordIssuedAt" TIMESTAMP(3);
