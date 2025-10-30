"use client";

import React, { JSX, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Loader2,
  CheckCircle,
  XCircle,
  Linkedin,
  Twitter,
  Facebook,
} from "lucide-react";

/**
 * app/contact/page.tsx
 *
 * Replace your existing file with this. It posts:
 * { orgName, contactName, email, phone, orgDomain, employees, interestedModules, preferredDate, message }
 * to /api/contact (your SendGrid route).
 */

type FormState = {
  orgName: string;
  contactName: string;
  email: string;
  phone?: string;
  orgDomain?: string;
  employees?: string;
  interestedModules?: string;
  preferredDate?: string;
  message: string;
};

export default function ContactPage(): JSX.Element {
  const [form, setForm] = useState<FormState>({
    orgName: "",
    contactName: "",
    email: "",
    phone: "",
    orgDomain: "",
    employees: "",
    interestedModules: "",
    preferredDate: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  const handleChange =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((p) => ({ ...p, [k]: e.target.value }));
    };

  function buildMailto() {
    const recipient = process.env.NEXT_PUBLIC_CONTACT_RECIPIENT || "";
    const subject = encodeURIComponent(`POSH Demo Request — ${form.orgName || "Organisation"}`);
    const body = encodeURIComponent(
      `Organisation: ${form.orgName}
Contact: ${form.contactName}
Email: ${form.email}
Phone: ${form.phone || ""}
Domain: ${form.orgDomain || ""}
Employees: ${form.employees || ""}
Interested modules: ${form.interestedModules || ""}
Preferred demo date/time: ${form.preferredDate || ""}

Message:
${form.message}`
    );

    return `mailto:${recipient}?subject=${subject}&body=${body}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic required field validation
    if (!form.orgName.trim() || !form.contactName.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please provide organisation, contact name, email and a short message.");
      return;
    }
    if (!validateEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSuccess("Thanks — your demo request was sent. We'll contact you shortly.");
        setForm({
          orgName: "",
          contactName: "",
          email: "",
          phone: "",
          orgDomain: "",
          employees: "",
          interestedModules: "",
          preferredDate: "",
          message: "",
        });
      } else {
        const json = await res.json().catch(() => ({}));
        // If server indicates no mailer configured, fallback to mail client
        if (json?.error === "NO_SENDGRID_CONFIG" || json?.error === "NO_SMTP_CONFIG") {
          // try mail client fallback
          window.location.href = buildMailto();
          setSuccess("Mail client opened as a fallback. Please send the prefilled email to complete the request.");
        } else {
          setError(json?.message || "Failed to send. Please try again or use the mail fallback.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Network error — please try again or use the mail fallback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full bg-indigo-50 rounded-2xl min-h-screen text-slate-800 mb-20 ">
      {/* MAIN (centered content area) */}
      <section className="w-full  py-12 flex-grow">
        <div className="mx-auto max-w-screen-xl px-7 lg:px-15 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left column: contact info + map */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-100 shadow-sm p-6 bg-white">
              <h2 className="text-xl font-semibold text-indigo-900">Get in touch</h2>
              <p className="mt-2 text-sm text-slate-600">
                Fill the form and our team will respond within 1 business day. For urgent matters, call us.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-amber-50">
                    <MapPin size={18} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Head Office</p>
                    <p className="text-sm text-slate-600">123 Compliance Ave, Chennai, TN, India</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-amber-50">
                    <Mail size={18} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Email</p>
                    <a className="text-sm text-amber-700 hover:underline" href="mailto:hello@lawcrafters.example">
                      hello@lawcrafters.example
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-amber-50">
                    <Phone size={18} className="text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-indigo-900">Phone</p>
                    <a className="text-sm text-amber-700 hover:underline" href="tel:+911234567890">
                      +91 12345 67890
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Map placeholder */}
            <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
              <iframe
                title="LawCrafters office map"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d50359.123456!2d72.8777!3d19.0760!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5c1a2b3c4d5e6f%3A0xabcdef1234567890!2sMumbai%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v0000000000000"
                loading="lazy"
                className="w-full h-56 border-0"
              />
            </div>
          </div>

          {/* Right column: form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-100 shadow-sm p-6 bg-white">
              <h3 className="text-xl font-semibold text-indigo-900">Request a POSH training demo</h3>
              <p className="mt-2 text-sm text-slate-600">Tell us about your organisation and preferred timing for a demo.</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Organisation name <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      value={form.orgName}
                      onChange={handleChange("orgName")}
                      placeholder="e.g. Acme Education Pvt Ltd"
                      required
                      aria-required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Contact name <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      value={form.contactName}
                      onChange={handleChange("contactName")}
                      placeholder="Your full name"
                      required
                      aria-required
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></span>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      value={form.email}
                      onChange={handleChange("email")}
                      placeholder="you@company.com"
                      required
                      aria-required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Phone</span>
                    <input
                      type="tel"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      value={form.phone}
                      onChange={handleChange("phone")}
                      placeholder="+91 98xxxx"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Organisation domain</span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      value={form.orgDomain}
                      onChange={handleChange("orgDomain")}
                      placeholder="company.com (optional)"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">No. of employees (approx.)</span>
                    <select
                      value={form.employees}
                      onChange={handleChange("employees")}
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    >
                      <option value="">Select range</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-1000">201-1000</option>
                      <option value="1000+">1000+</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Message <span className="text-red-500">*</span></span>
                  <textarea
                    className="mt-1 w-full rounded-md border px-3 py-2 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-amber-300"
                    value={form.message}
                    onChange={handleChange("message")}
                    placeholder="Any context we should know before the demo?"
                    required
                    aria-required
                  />
                </label>

                {/* status messages */}
                {error && (
                  <div className="flex items-center gap-3 text-red-600 bg-red-50 border border-red-100 rounded-md p-3">
                    <XCircle size={18} />
                    <span className="text-sm">{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md p-3">
                    <CheckCircle size={18} />
                    <span className="text-sm">{success}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-3 rounded-lg bg-amber-400 text-indigo-900 px-6 py-2 text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                    <span>{loading ? "Sending..." : "Request Demo"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => (window.location.href = buildMailto())}
                    className="px-4 py-2 border border-amber-200 rounded text-amber-700 text-sm"
                  >
                    Use Mail Client
                  </button>
                </div>

                <p className="text-xs text-slate-500 mt-1">
                  By submitting, you agree we may contact you regarding POSH training. We won't share your details.
                </p>
              </form>
            </div>

            <p className="mt-4 text-xs text-slate-500">
  If you prefer scheduling directly, use the{" "}
  <Link href="/" className="text-amber-700 underline">
    Schedule a call
  </Link>{" "}
  option.
</p>
          </div>
        </div>
      </section>

      
    </main>
  );
}
