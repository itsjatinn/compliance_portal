"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  // Validate that a token exists in the URL
  useEffect(() => {
    if (!token) {
      setStatus({ type: "error", message: "Missing or invalid reset token." });
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation
    if (!token) {
      setStatus({ type: "error", message: "Missing reset token." });
      return;
    }

    if (password.length < 8) {
      setStatus({
        type: "error",
        message: "Password must be at least 8 characters long.",
      });
      return;
    }

    if (password !== confirm) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setStatus({ type: "loading" });

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ backend expects newPassword key (not password)
        body: JSON.stringify({ token, newPassword: password }),
      });

      const payload = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus({
          type: "success",
          message: "Password updated — redirecting to login...",
        });
        // redirect to login after short delay
        setTimeout(() => router.push("/login"), 1500);
      } else {
        setStatus({
          type: "error",
          message:
            payload?.error ||
            payload?.message ||
            "Failed to reset password. Please try again.",
        });
      }
    } catch (err) {
      console.error("Reset password network error:", err);
      setStatus({
        type: "error",
        message: "Network error — please try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" value={token} />

      {/* New password input */}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">New password</span>
        <input
          type="password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          placeholder="At least 8 characters"
        />
      </label>

      {/* Confirm password input */}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Confirm password
        </span>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 block w-full rounded-md border px-3 py-2"
          placeholder="Repeat password"
        />
      </label>

      {/* Submit button */}
      <button
        type="submit"
        disabled={status.type === "loading" || !token}
        className="w-full py-2 rounded-md bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
      >
        {status.type === "loading" ? "Updating..." : "Reset password"}
      </button>

      {/* Status messages */}
      {status.type === "success" && (
        <div className="mt-2 text-sm text-green-600">{status.message}</div>
      )}
      {status.type === "error" && (
        <div className="mt-2 text-sm text-red-600">{status.message}</div>
      )}
    </form>
  );
}
