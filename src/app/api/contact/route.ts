// app/api/contact/route.ts  (or src/app/api/contact/route.ts)
import { NextResponse } from "next/server";
import sendgrid from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
}

type Body = {
  orgName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  orgDomain?: string;
  employees?: string;
  interestedModules?: string;
  preferredDate?: string;
  message?: string;
};

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json({ error: "NO_SENDGRID_CONFIG", message: "SendGrid API key not configured." }, { status: 500 });
  }

  const body: Body = await req.json().catch(() => ({}));
  const {
    orgName = "",
    contactName = "",
    email = "",
    phone = "",
    orgDomain = "",
    employees = "",
    interestedModules = "",
    preferredDate = "",
    message = ""
  } = body;

  if (!orgName || !contactName || !email) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "Please provide organisation, contact name and email." }, { status: 400 });
  }

  const recipient = process.env.CONTACT_RECIPIENT;
  const sender = process.env.CONTACT_SENDER || `no-reply@${(process.env.NEXT_PUBLIC_VERCEL_URL || "example.com").replace(/^https?:\/\//, "")}`;

  if (!recipient) {
    return NextResponse.json({ error: "NO_RECIPIENT_CONFIG", message: "CONTACT_RECIPIENT not configured." }, { status: 500 });
  }

  const html = `
    <h2>New POSH Demo Request</h2>
    <table cellpadding="6" cellspacing="0" border="0" style="font-family:Arial, sans-serif; font-size:14px;">
      <tr><td><strong>Organisation</strong></td><td>${escapeHtml(orgName)}</td></tr>
      <tr><td><strong>Contact</strong></td><td>${escapeHtml(contactName)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone)}</td></tr>
      <tr><td><strong>Domain</strong></td><td>${escapeHtml(orgDomain)}</td></tr>
      <tr><td><strong>Employees</strong></td><td>${escapeHtml(employees)}</td></tr>
      <tr><td><strong>Interested</strong></td><td>${escapeHtml(interestedModules)}</td></tr>
      <tr><td><strong>Preferred</strong></td><td>${escapeHtml(preferredDate)}</td></tr>
      <tr><td valign="top"><strong>Message</strong></td><td>${escapeHtml(message).replace(/\n/g,'<br/>')}</td></tr>
    </table>
  `;

  try {
    await sendgrid.send({
      to: recipient,
      from: sender,
      subject: `POSH Demo Request — ${orgName} (${contactName})`,
      text: `Organisation: ${orgName}\nContact: ${contactName}\nEmail: ${email}\nPhone: ${phone}\nDomain: ${orgDomain}\nEmployees: ${employees}\nInterested modules: ${interestedModules}\nPreferred demo date/time: ${preferredDate}\n\nMessage:\n${message}`,
      html
    });

    return NextResponse.json({ ok: true, message: "Email sent" }, { status: 200 });
  } catch (err: any) {
    console.error("SendGrid error:", err?.response?.body || err);
    return NextResponse.json({ error: "SEND_FAILED", message: "Failed to send email. Check server logs." }, { status: 500 });
  }
}
