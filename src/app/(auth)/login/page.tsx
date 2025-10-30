"use client";

import React, { JSX, useState } from "react";
import Link from "next/link";

type Role = "ADMIN" | "ORG_ADMIN" | "LEARNER" | string;

const LOCAL_USER_KEY = "auth_user";
const AUTH_CHANGED_EVENT = "auth:changed";

function setLocalUser(user: any | null) {
  try {
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  } catch {
    // ignore storage errors
  }
}

export default function LoginPage(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password, remember }),
        credentials: "include", // ensure Set-Cookie is accepted by the browser
      });

      if (!res.ok) {
        let parsed: any = null;
        try {
          parsed = await res.json();
        } catch {
          /* ignore parse error */
        }
        const errMsg = parsed?.error || `Login failed (${res.status})`;
        setError(errMsg);
        setLoading(false);
        return;
      }

      const data: any = await res.json().catch(() => null);
      // Persist returned user (if present) so dashboards update immediately
      const returnedUser = data?.user ?? null;
      if (returnedUser) {
        try {
          setLocalUser(returnedUser);
        } catch {}
      }

      // support both shapes: { user: { role } } or { role }
      const role: Role | undefined = data?.user?.role || data?.role;

      // read returnTo from querystring if present
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo") || undefined;

      // Prefer returnTo if provided — do a full navigation to ensure cookie commit
      if (returnTo) {
        window.location.href = returnTo;
        return;
      }

      if (!role) {
        window.location.href = "/welcome";
        return;
      }

      switch (String(role).toUpperCase()) {
        case "ADMIN":
          window.location.href = "/admin";
          break;
        case "ORG_ADMIN":
          window.location.href = "/OrgAdmin";
          break;
        case "LEARNER":
          window.location.href = "/Employee";
          break;
        default:
          window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen -mt-8 mr-5 ml-5 rounded-3xl  bg-linear-to-b from-indigo-950 to-indigo-900 text-white">
      <main className="w-full items-center justify-center px-8 lg:px-15">
        <div className="max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center py-20">
          {/* Left intro */}
          <aside className="px-8 md:px-0">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Continue your{" "}
              <span className="text-(--color-accent-400)">POSH Training</span>
            </h1>
            <p className="mt-4 text-base text-slate-200 max-w-lg">
              Sign in to access your courses, track your progress, and complete
              mandatory compliance modules that build safer workplaces.
            </p>

            <div className="mt-8 space-y-5 max-w-md">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 grid place-items-center text-[var(--color-accent-400)] font-semibold">
                  🎓
                </div>
                <div>
                  <div className="font-medium">Interactive modules</div>
                  <div className="text-sm text-slate-300">
                    Learn through engaging, story-based POSH training modules.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 grid place-items-center text-[var(--color-accent-400)] font-semibold">
                  📊
                </div>
                <div>
                  <div className="font-medium">Progress tracking</div>
                  <div className="text-sm text-slate-300">
                    HR and admins can monitor completion rates in real time.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 grid place-items-center text-[var(--color-accent-400)] font-semibold">
                  ✅
                </div>
                <div>
                  <div className="font-medium">Certificates on completion</div>
                  <div className="text-sm text-slate-300">
                    Automatic certificates are generated when training is
                    completed.
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right form */}
          <section className="mx-auto pt-10 w-full max-w-xl">
            <div className="bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 rounded-2xl p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">Sign in</h2>
                <p className="text-sm text-slate-500">Enter your credentials to continue</p>
              </div>

              {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)] pr-24"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    <span>Remember me</span>
                  </label>

                  <Link href="/forgot-password" className="text-[var(--color-accent-600)] hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-md bg-[var(--color-accent-500)] text-white font-semibold hover:bg-[var(--color-accent-600)] disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                New here?{" "}
                <Link href="/signup" className="text-[var(--color-accent-600)] hover:underline">
                  Create account
                </Link>
              </div>

              <div className="mt-4 text-center text-sm text-slate-500">
                By signing in, you agree to our{" "}
                <Link href="/terms" className="text-[var(--color-accent-600)] hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-[var(--color-accent-600)] hover:underline">
                  Privacy policy
                </Link>
                .
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-slate-300">© {new Date().getFullYear()} ZaroHR — cutting through clutter.</div>
          </section>
        </div>
      </main>
    </div>
  );
}
