import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    // Basic validation
    if (!token || !newPassword) {
      return NextResponse.json(
        { error: "Token and newPassword required" },
        { status: 400 }
      );
    }

    // Find the reset token record
    const record = await prisma.passwordResetToken.findUnique({
      where: { token }, // 🔥 search by token, not id
      include: { user: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    // Check expiration
    if (new Date() > record.expiresAt) {
      await prisma.passwordResetToken.delete({
        where: { token }, // 🔥 delete by token for consistency
      });
      return NextResponse.json({ error: "Token expired" }, { status: 400 });
    }

    // Hash the new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    });

    // Delete the used token after success
    await prisma.passwordResetToken.delete({
      where: { token }, // 🔥 ensures token is removed properly
    });

    console.log(`✅ Password reset successful for userId: ${record.userId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ reset-password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
