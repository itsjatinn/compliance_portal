// src/lib/mail.ts
import sgMail from "@sendgrid/mail";

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY is not set.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.log("🔔 DEV: sendEmail not configured - printing mail to console.");
    console.log({ to, subject, html });
    return;
  }

  try {
    const msg = {
      to,
      from: process.env.EMAIL_FROM!, // must be a verified sender in SendGrid for free plan
      subject,
      html,
    };
    const res = await sgMail.send(msg);
    console.log("📨 SendGrid response:", res && res[0] && res[0].statusCode);
    return res;
  } catch (err) {
    console.error("❌ SendGrid send error:", err);
    throw err;
  }
}
