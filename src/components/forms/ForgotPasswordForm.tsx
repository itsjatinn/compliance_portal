// components/forms/ForgotPasswordForm.tsx
"use client";

import React, { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" | "loading" | "success" | "error"; message?: string }
  >({ type: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus({ type: "loading" });

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus({
          type: "success",
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      } else {
        const payload = await res.json().catch(() => ({}));
        setStatus({
          type: "error",
          message:
            payload?.message || "Unable to send reset email. Please try later.",
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Network error — try again." });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none"
          placeholder="you@example.com"
        />
      </label>

      <button
        type="submit"
        disabled={status.type === "loading"}
        className="w-full py-2 rounded-md bg-indigo-600 text-white disabled:opacity-60"
      >
        {status.type === "loading" ? "Sending..." : "Send reset link"}
      </button>

      {status.type === "success" && (
        <div className="mt-2 text-sm text-green-600">{status.message}</div>
      )}
      {status.type === "error" && (
        <div className="mt-2 text-sm text-red-600">{status.message}</div>
      )}
    </form>
  );
}
