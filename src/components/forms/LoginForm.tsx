// src/components/forms/LoginForm.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

type ApiError = {
  type?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  raw?: string;
  body?: any;
  url?: string;
  error?: any;
};

async function postJson(url: string, data: any) {
  try {
    // Resolve URL for clearer logs
    const resolved = (() => {
      try {
        return new URL(url, typeof window !== "undefined" ? window.location.href : "http://localhost:3000").href;
      } catch {
        return String(url);
      }
    })();

    console.log("postJson -> calling", resolved, "payload:", data);
    if (typeof navigator !== "undefined") {
      console.log("navigator.onLine:", navigator.onLine);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include", // include cookies for same-origin
    });

    // Read raw text (works whether response is JSON or HTML)
    const raw = await res.text();

    // Try to parse JSON; if invalid JSON we'll keep parsed = null
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    // Collect headers
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));

    // Log lots of useful debug info
    console.groupCollapsed(`HTTP ${res.status} ${res.statusText} — ${resolved}`);
    console.log("Request payload:", data);
    console.log("Response headers:", headers);
    console.log("Raw response body (first 2000 chars):", typeof raw === "string" ? raw.slice(0, 2000) : raw);
    console.log("Parsed JSON (if any):", parsed);
    console.groupEnd();

    if (!res.ok) {
      // Throw a structured error object (client will log and show message)
      throw {
        type: "api_error",
        status: res.status,
        statusText: res.statusText,
        headers,
        raw,
        body: parsed,
        url: resolved,
      } as ApiError;
    }

    return { status: res.status, body: parsed ?? raw };
  } catch (err: any) {
    // Rich logging for fetch/network errors
    console.error("postJson network/fetch error — typeof:", typeof err);
    console.error("error.name:", err?.name);
    console.error("error.message:", err?.message);
    console.error("error.stack:", err?.stack);
    try { console.error("error.toString():", String(err)); } catch {}
    try { console.dir(err); } catch {}

    if (typeof window !== "undefined") {
      console.log("location.href:", window.location.href);
      try {
        console.log("fetch target (resolved):", new URL(url, window.location.href).href);
      } catch {
        console.log("fetch target (raw):", url);
      }
    }

    // Normalize thrown error for the caller
    throw { type: "network_error", error: err, url } as ApiError;
  }
}

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const { status, body } = await postJson("/api/auth/login", {
        email: trimmedEmail.toLowerCase(),
        password,
      });

      console.log("Login success:", { status, body });

      // Typical: server sets httpOnly refresh cookie; client uses body/user info as needed
      // Redirect to dashboard or your post-login page
      router.push("/dashboard");
    } catch (err) {
      // Log full error so we can debug (you'll see structured info instead of "{}")
      console.error("Login error — full object:", err);

      // Try to extract a useful message for the user
      if (err && typeof err === "object") {
        const apiErr = err as ApiError;
        const msg =
          apiErr.body?.message ??
          apiErr.body?.error ??
          apiErr.statusText ??
          (apiErr.type === "network_error" ? "Network error — could not reach server" : "Login failed");
        setErrorMsg(String(msg));
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-md shadow-sm">
      <h2 className="text-2xl font-semibold mb-4">Login</h2>

      {errorMsg && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-100" role="alert">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" aria-live="polite">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded border px-3 py-2 focus:outline-none focus:ring"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded border px-3 py-2 focus:outline-none focus:ring"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Login"}
          </button>

          <a href="/forgot-password" className="text-sm text-indigo-600 hover:underline">
            Forgot password?
          </a>
        </div>
      </form>
    </div>
  );
}
