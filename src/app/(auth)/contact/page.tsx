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
  Menu,
  X,
  Linkedin,
  Twitter,
  Facebook,
} from "lucide-react";

/**
 * app/contact/page.tsx
 */

type FormState = {
  name: string;
  email: string;
  company?: string;
  subject: string;
  message: string;
};

export default function ContactPage(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  const handleChange = (k: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("Please fill in all required fields.");
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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to send message");
      }

      setSuccess("Thanks — we received your message. We'll get back to you shortly.");
      setForm({ name: "", email: "", company: "", subject: "", message: "" });
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-white text-slate-800 flex flex-col">

      {/* MAIN (centered content area) */}
      <section className="w-full py-12 flex-grow">
        <div className="mx-auto max-w-screen-xl px-6 lg:px-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left column: contact info + map */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-xl font-semibold">Get in touch</h2>
              <p className="mt-2 text-sm text-slate-600">
                Fill the form and our team will respond within 1 business day. For urgent matters, call us.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Head Office</p>
                    <p className="text-sm text-slate-600">123 Compliance Ave, Chennai, TN, India</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <a className="text-sm text-sky-600 hover:underline" href="mailto:hello@lawcrafters.example">
                      hello@lawcrafters.example
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-slate-50">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <a className="text-sm text-sky-600 hover:underline" href="tel:+911234567890">
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
              />
            </div>
          </div>

          {/* Right column: form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-xl font-semibold">Send us a message</h3>
              <p className="mt-2 text-sm text-slate-600">Tell us about your requirement and preferred timing for a demo.</p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">Name <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      value={form.name}
                      onChange={handleChange("name")}
                      placeholder="Your full name"
                      required
                      aria-required
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Email <span className="text-red-500">*</span></span>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      value={form.email}
                      onChange={handleChange("email")}
                      placeholder="you@company.com"
                      required
                      aria-required
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium">Company</span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      value={form.company}
                      onChange={handleChange("company")}
                      placeholder="Optional"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium">Subject <span className="text-red-500">*</span></span>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                      value={form.subject}
                      onChange={handleChange("subject")}
                      placeholder="Brief subject"
                      required
                      aria-required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-medium">Message <span className="text-red-500">*</span></span>
                  <textarea
                    className="mt-1 w-full rounded-md border px-3 py-2 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-sky-400"
                    value={form.message}
                    onChange={handleChange("message")}
                    placeholder="Tell us more..."
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
                    className="inline-flex items-center gap-3 rounded-lg bg-slate-900 text-white px-6 py-2 text-sm font-medium shadow-sm hover:opacity-95 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                    <span>{loading ? "Sending..." : "Send message"}</span>
                  </button>

                  <p className="text-xs text-slate-500">We reply within 1 business day.</p>
                </div>
              </form>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              By contacting us you agree to our terms and privacy policy. We treat your information with strict confidentiality.
            </p>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="w-full bg-slate-50 py-8">
        <div className="mx-auto max-w-screen-xl px-6 lg:px-20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold">Need a tailored compliance review?</h4>
            <p className="text-sm text-slate-600">Book a free 20-min consultation with our compliance experts.</p>
          </div>
          <div>
            <Link href="/contact" className="inline-block rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-sky-700">
              Schedule a call
            </Link>
          </div>
        </div>
      </section>

      
    </main>
  );
}
