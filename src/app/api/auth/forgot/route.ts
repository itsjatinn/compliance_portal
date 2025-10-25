// app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { randomBytes } from "crypto";
import { addMinutes } from "date-fns";
import { sendEmail } from "../../../../lib/mail";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // To avoid user enumeration, return ok even if user not found
      return NextResponse.json({ ok: true });
    }

    // delete old tokens for the user (optional)
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString("hex");
    const expiresAt = addMinutes(new Date(), 60); // 60 minutes

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

   const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password?token=${token}`;

await sendEmail({
  to: user.email,
  subject: "Password reset request",
  html: `<p>Click <a href="${resetUrl}">Reset password</a>. This link expires in 60 minutes.</p>`,
});


    // Send email
    console.log("🔑 Password reset link (dev mode):", resetUrl);
    // await sendEmail({
    //   to: user.email,
    //   subject: "Password reset request",
    //   html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 60 minutes.</p>`,
    // });

    // For dev: return token so frontend can display it if you need (REMOVE in prod)
    return NextResponse.json({ ok: true, debugToken: token });
  } catch (err) {
    console.error("forgot-password error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
