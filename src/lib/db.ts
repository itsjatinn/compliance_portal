import { PrismaClient, User } from "@prisma/client";
import { randomBytes } from "crypto";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;

/** Basic user helpers */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

/** Refresh token helpers (from earlier) */
export async function saveRefreshToken(userId: string, token: string) {
  try {
    // @ts-ignore
    return await (prisma as any).refreshToken.create({ data: { token, userId } });
  } catch (err) {
    // fallback: store on user.refreshToken (if field exists)
    // @ts-ignore
    return prisma.user.update({ where: { id: userId }, data: { refreshToken: token } });
  }
}

export async function verifyRefreshTokenInDB(userId: string, token: string): Promise<boolean> {
  try {
    // Try RefreshToken table first
    // @ts-ignore
    const rt = await (prisma as any).refreshToken.findUnique({ where: { token } });
    if (rt && rt.userId === userId) return true;

    // Fallback: check user.refreshToken
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { refreshToken: true } as any });
    // @ts-ignore
    return !!(user && user.refreshToken === token);
  } catch (err) {
    console.error("verifyRefreshTokenInDB error:", err);
    return false;
  }
}

export async function revokeRefreshToken(userId: string, token?: string) {
  try {
    if (token) {
      try {
        // @ts-ignore
        await (prisma as any).refreshToken.delete({ where: { token } });
      } catch (e) {}
    } else {
      try {
        // @ts-ignore
        await (prisma as any).refreshToken.deleteMany({ where: { userId } });
      } catch (e) {}
    }
    try {
      // @ts-ignore
      await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    } catch (e) {}
  } catch (err) {
    console.error("revokeRefreshToken error:", err);
  }
}

/** Password-reset helpers */

/**
 * Create a secure random token, persist it (PasswordReset model preferred),
 * or fallback to storing resetToken on user. Returns the token string.
 */
export async function createResetTokenForUser(userId: string): Promise<string> {
  // 32 bytes hex => 64 chars
  const token = randomBytes(32).toString("hex");
  try {
    // Try to write to PasswordReset model if present
    // @ts-ignore
    const created = await (prisma as any).passwordReset.create({
      data: {
        token,
        userId,
        // createdAt and used fields handled by Prisma model defaults
      },
    });
    return token;
  } catch (err) {
    // Fallback: attempt to store token on user.resetToken field
    try {
      // @ts-ignore
      await prisma.user.update({ where: { id: userId }, data: { resetToken: token } });
      return token;
    } catch (e) {
      console.error("createResetTokenForUser fallback failed:", e);
      throw new Error("Unable to create reset token");
    }
  }
}

/**
 * Verify reset token exists and return user (PasswordReset preferred, fallback to user.resetToken)
 */
export async function verifyResetTokenAndGetUser(token: string): Promise<User | null> {
  try {
    // Try lookup in PasswordReset table
    try {
      // @ts-ignore
      const pr = await (prisma as any).passwordReset.findUnique({ where: { token }, include: { user: true } });
      if (pr && pr.user) {
        // optionally check `used` flag or createdAt expiry here
        // @ts-ignore
        if (pr.used === true) return null;
        return pr.user as User;
      }
    } catch (e) {
      // fallthrough to fallback
    }

    // Fallback: find user with matching resetToken field
    try {
      // @ts-ignore
      const user = await prisma.user.findFirst({ where: { resetToken: token } }) as User | null;
      return user;
    } catch (e) {
      console.error("verifyResetTokenAndGetUser fallback error:", e);
      return null;
    }
  } catch (err) {
    console.error("verifyResetTokenAndGetUser error:", err);
    return null;
  }
}

/**
 * Set a new password for a user (expects hashedPassword), clear reset records.
 */
export async function setNewPassword(userId: string, hashedPassword: string): Promise<Partial<User> | null> {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        // attempt to clear fallback resetToken field
        // @ts-ignore
        resetToken: null,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true } as any,
    });

    // delete PasswordReset entries for user (if model exists)
    try {
      // @ts-ignore
      await (prisma as any).passwordReset.deleteMany({ where: { userId } });
    } catch (e) {
      // ignore if model doesn't exist
    }

    return updated as Partial<User>;
  } catch (err) {
    console.error("setNewPassword error:", err);
    return null;
  }
}
