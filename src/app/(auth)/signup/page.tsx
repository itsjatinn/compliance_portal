"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const LOCAL_USER_KEY = "auth_user";
const AUTH_CHANGED_EVENT = "auth:changed";

function setLocalUser(user: any | null) {
  try {
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
    }
    // notify other parts of the app (header, etc.)
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  } catch {
    // ignore storage errors
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name, email, password }),
        credentials: "include", // changed to include cookies across origins
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          setError(json.error || "Signup failed");
        } catch {
          setError(`Signup failed: ${res.status}`);
        }
        setLoading(false);
        return;
      }

      // Prefer using returned user from signup response if present
      let data: any = null;
      try {
        data = await res.json().catch(() => null);
      } catch {
        data = null;
      }

      let user = data?.user ?? null;

      // If signup response didn't include the canonical user, try /api/auth/me
      if (!user) {
        try {
          const meRes = await fetch("/api/auth/me", { credentials: "include", headers: { Accept: "application/json" } });
          if (meRes.ok) {
            const meJson = await meRes.json().catch(() => null);
            user = meJson?.user ?? null;
          } else {
            // if /api/auth/me fails, fallback to no user
            const txt = await meRes.text().catch(() => "");
            console.warn("Signup: /api/auth/me failed:", meRes.status, txt);
          }
        } catch (err) {
          console.warn("Signup: error fetching /api/auth/me", err);
        }
      }

      if (user) {
        // persist user locally and notify other pages/components
        setLocalUser(user);
      } else {
        // defensive: if no user available, ensure we don't leave stale data
        setLocalUser(null);
        setError("Signup succeeded but no user was returned from /api/auth/me.");
        setLoading(false);
        return;
      }

      // redirect to Employee (same as before)
      router.push("/Employee");
    } catch (err) {
      console.error(err);
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen -mt-8 mb-18 mr-5 ml-5 rounded-3xl bg-gradient-to-b from-indigo-950 to-indigo-900 text-white">
      <div className="max-w-9xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center py-16 px-12 lg:px-20">
        {/* Left side content */}
        <aside>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Start your{" "}
            <span className="text-[var(--color-accent-400)]">POSH Training</span>
          </h1>
          <p className="mt-4 text-base text-slate-200 max-w-lg">
            Create your account and begin interactive modules designed to build
            awareness, safety, and compliance in your workplace.
          </p>

          <div className="mt-8 space-y-5 max-w-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 grid place-items-center text-[var(--color-accent-400)] font-semibold">
                🎓
              </div>
              <div>
                <div className="font-medium">Interactive learning</div>
                <div className="text-sm text-slate-300">
                  Engage with story-based, scenario-driven compliance modules.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 grid place-items-center text-[var(--color-accent-400)] font-semibold">
                📊
              </div>
              <div>
                <div className="font-medium">Track your progress</div>
                <div className="text-sm text-slate-300">
                  Stay on top of your mandatory training and deadlines.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 grid place-items-center text-[var(--color-accent-400)] font-semibold">
                ✅
              </div>
              <div>
                <div className="font-medium">Certificates awarded</div>
                <div className="text-sm text-slate-300">
                  Receive completion certificates automatically for each course.
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right side form */}
        <section className="mx-auto w-full max-w-xl">
          <div className="bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold">Create account</h2>
              <p className="text-sm text-slate-500">Enter your details to get started</p>
            </div>

            {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]"
                  placeholder="Create a password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Confirm password</label>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  type="password"
                  className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]"
                  placeholder="Confirm password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-md bg-[var(--color-accent-500)] text-white font-semibold hover:bg-[var(--color-accent-600)] disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Sign up"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--color-accent-600)] hover:underline">
                Sign in
              </Link>
            </div>

            <div className="mt-4 text-center text-sm text-slate-500">
              By creating an account you agree to our{" "}
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

          <div className="mt-4 text-center text-xs text-slate-300">
            © {new Date().getFullYear()} ZaroHR — cutting through clutter.
          </div>
        </section>
      </div>
    </div>
  );
}
