// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // allow global var across module reloads in development
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Create or reuse PrismaClient instance
const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

// Export both named and default to be compatible with different import styles
export { prisma };
export default prisma;
