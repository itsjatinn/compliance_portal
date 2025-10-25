// app/reset-password/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import ResetPasswordForm from "../../../components/forms/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="max-w-full flex rounded-2xl -mt-5 flex-col bg-gray-100">
      {/* top spacer */}
      <div className="w-full pb-0">
        <div className="mx-auto px-15 lg:px-20" />
      </div>

      <main className="flex-1 flex w-full items-center justify-center px-4 py-12">
        <div className="w-full max-w-8xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left promo */}
            <aside className="hidden md:flex flex-col justify-center px-10">
              <div className="mb-6">
                <h2 className="text-3xl font-extrabold text-slate-900">
                  Choose a new password
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  Use the link we emailed you to set a new secure password.
                </p>
              </div>

              <div className="rounded-xl bg-indigo-100 p-6">
                <div className="text-sm text-slate-700">
                  <strong>Security tip:</strong> Choose a strong password and
                  avoid reusing passwords used elsewhere.
                </div>
              </div>
            </aside>

            {/* Right: form card */}
            <section className="mx-auto w-full max-w-md">
              <div className="bg-white/60 backdrop-blur-md rounded-2xl p-6 md:p-8 ring-1 ring-slate-200 shadow-xl">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                      Reset your password
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      Set a new password using the secure link we sent you.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href="/login"
                      className="px-3 py-2 rounded border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Login
                    </Link>

                    <Link
                      href="/signup"
                      className="px-3 py-2 rounded text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Signup
                    </Link>
                  </div>
                </div>

                <div className="mb-4">
                  <ResetPasswordForm />
                </div>

                <div className="mt-4 text-center text-sm text-slate-500">
                  Remembered your password?{" "}
                  <Link href="/login" className="text-indigo-600 hover:underline">
                    Sign in
                  </Link>
                </div>
              </div>

              <div className="mt-6 text-center text-xs text-slate-400">
                © {new Date().getFullYear()} LawCrafters — built for compliance
                teams.
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
