// src/app/(auth or dashboard)/components/TopNav.tsx
"use client";

import React from "react";
import Link from "next/link";

/* Inline HR Badge Icon — transparent background, accent-400 fill */
function HRTrioBadge({
  size = 44,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const r = 22; // ring radius (keep constant everywhere)

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-label="ZaroHR"
    >
      {/* ✅ single subtle ring */}
      <circle cx="24" cy="24" r={r} fill="transparent" />
      <circle
        cx="24"
        cy="24"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="2"
      />

      {/* ✅ HR trio in accent */}
      <g fill="var(--color-accent-400)">
        <circle cx="16" cy="18" r="4" />
        <circle cx="32" cy="18" r="4" />
        <circle cx="24" cy="15" r="4" />
        <path d="M12.5 28c0-4 3.5-6 7.5-6s7.5 2 7.5 6v.6c-2.1 1.7-5.6 1.7-7.7 0-2.1 1.7-5.6 1.7-7.7 0V28z" />
        <path d="M21 28c0-4 3.5-6 7.5-6s7.5 2 7.5 6v.6c-2.1 1.7-5.6 1.7-7.7 0-2.1 1.7-5.6 1.7-7.7 0V28z" />
      </g>
    </svg>
  );
}

export default function TopNav() {
  return (
    <header className="w-full -z-10 relative">
      <div className="max-w-10xl mx-auto px-9 lg:px-11">
        <div
          className="
            bg-linear-to-t from-indigo-950 via-indigo-900 to-indigo-800
            text-white shadow-lg rounded-b-3xl
            flex items-center justify-center
            px-6 py-6
          "
          role="banner"
          aria-label="ZaroHR"
        >
          {/* Logo only (centered) */}
          <Link
            href="/Employee"
            className="flex items-center gap-3 transition-transform duration-300 hover:scale-[1.05] hover:opacity-95"
          >
            <HRTrioBadge
              size={44}
              className="transition-transform duration-300"
              style={{ color: "var(--color-accent-400)" }}
            />

            <div
              className="leading-tight select-none text-left"
              style={{ fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui" }}
            >
              <div className="text-xl md:text-2xl font-extrabold tracking-tight text-white">
                Zaro
                <span className="ml-1 font-black" style={{ color: "var(--color-accent-400)" }}>
                  HR
                </span>
              </div>
              <div className="text-xs md:text-sm text-white/80">
                cutting through clutter
              </div>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
