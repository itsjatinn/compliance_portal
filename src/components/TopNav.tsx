// src/app/(auth or dashboard)/components/TopNav.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  BookOpen,
  Scroll,
  Briefcase,
  Menu,
  CogIcon,
  X
} from "lucide-react";

/* ---------------- Custom HR Icons (choose badge by default) ---------------- */

/** Outline icon – Lucide-like (use if you prefer strokes over filled badge) */
function HRTrioIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="HR"
      {...props}
    >
      {/* heads */}
      <circle cx="6" cy="8" r="2.25" />
      <circle cx="18" cy="8" r="2.25" />
      <circle cx="12" cy="6.5" r="2.25" />
      {/* shoulders/bodies */}
      <path d="M3.5 14c0-2.3 2-3.8 4.5-3.8S12.5 11.7 12.5 14" />
      <path d="M11.5 14c0-2.3 2-3.8 4.5-3.8S20.5 11.7 20.5 14" />
      {/* team link */}
      <path d="M7.25 16c1.5 1.3 4 1.3 5.5 0M10.75 16c1.5 1.3 4 1.3 5.5 0" />
    </svg>
  );
}

/** Filled circular badge – great at small sizes & matches your mock */
function HRTrioBadge({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-label="ZaroHR"
    >
      {/* circular badge */}
      <defs>
        <linearGradient id="zaroBadge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2f6e" />
          <stop offset="1" stopColor="#272b63" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#zaroBadge)" />
      <circle cx="24" cy="24" r="22" fill="none" stroke="#000" opacity=".06" />
      {/* icon – simplified solid for clarity */}
      <g fill="#facc15">
        {/* heads */}
        <circle cx="16" cy="18" r="4" />
        <circle cx="32" cy="18" r="4" />
        <circle cx="24" cy="15" r="4" />
        {/* shoulders / base links */}
        <path d="M12.5 28c0-4 3.5-6 7.5-6s7.5 2 7.5 6v.6c-2.1 1.7-5.6 1.7-7.7 0-2.1 1.7-5.6 1.7-7.7 0V28z" />
        <path d="M21 28c0-4 3.5-6 7.5-6S36 24 36 28v.6c-2.1 1.7-5.6 1.7-7.7 0-2.1 1.7-5.6 1.7-7.7 0V28z" />
      </g>
    </svg>
  );
}

/* -------------------------------- Component -------------------------------- */

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const btnBase =
    "inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition";

  const HEADER_OFFSET = 88;

  function scrollToIdWithOffset(id: string) {
    const el = document.getElementById(id);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const absoluteY = rect.top + window.scrollY;
    const targetY = Math.max(0, absoluteY - HEADER_OFFSET);
    window.scrollTo({ top: targetY, behavior: "smooth" });
    history.replaceState(null, "", `#${id}`);
    return true;
  }

  async function handleSectionClick(e: React.MouseEvent, id: string) {
    e.preventDefault();

    if (pathname === "/" || pathname === "" || pathname === "/home") {
      const ok = scrollToIdWithOffset(id);
      if (!ok) window.location.hash = `#${id}`;
      return;
    }

    await router.push("/");

    let attempt = 0;
    const tries = 20;
    const waitAndScroll = () => {
      attempt++;
      const ok = scrollToIdWithOffset(id);
      if (!ok && attempt < tries) setTimeout(waitAndScroll, 80);
    };
    setTimeout(waitAndScroll, 120);
  }

  const navLink =
    "flex items-center gap-2 px-5 py-2 rounded-md text-m whitespace-nowrap transition-all duration-300 hover:gap-1 text-white hover:text-[var(--color-accent-400)]";

  return (
    <header className="w-full -mt-5 -mb-10 z-50">
      <div className="max-w-10xl mx-auto px-9 lg:px-11">
        <div
          className="
            bg-linear-to-t from-indigo-950 to-indigo-900
            text-white shadow-lg rounded-3xl max-w-10xl 
            flex items-center justify-between gap-6
            px-6 py-3 pr-10 pl-10 pt-10 pb-8
          "
          role="navigation"
          aria-label="Top Navigation"
        >
          {/* Brand: entire block links to home, with hover zoom */}
          <Link
            href="/"
            aria-label="ZaroHR Home"
            className="
              group inline-flex items-center gap-3 shrink-0
              transition-transform duration-300
              hover:scale-105 md:hover:scale-110
              focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-100/90
              focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900 rounded-full
              motion-reduce:transition-none motion-reduce:hover:scale-100
            "
          >
            {/* Icon */}
            <span className="inline-flex  items-center justify-center rounded-full p-0.5">
              <HRTrioBadge
                size={44}
                className="transition-transform duration-300 group-hover:scale-[1.06]"
              />
              {/* If you prefer the stroke style instead: */}
              {/* <HRTrioIcon className="w-8 h-8 text-yellow-400 transition-transform duration-300 group-hover:scale-[1.06]" /> */}
            </span>

            {/* Brand Text */}
            <span
              className="leading-tight select-none"
              style={{ fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui" }}
            >
              <span className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Zaro
              </span>
              <span className="ml-1 text-2xl md:text-3xl font-black text-amber-300 transition group-hover:drop-shadow-[0_0_10px_rgba(250,204,21,0.55)]">
                HR
              </span>
              <div className="text-[11px] md:text-xs text-white/80 tracking-wide -mt-0.5">
                cutting through clutter
              </div>
            </span>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-2">
              <a
                href="#features"
                onClick={(e) => handleSectionClick(e, "features")}
                className={navLink}
              >
                <FileText className="w-4 h-4 text-[var(--color-accent-100)]" />
                <span>Features</span>
              </a>

              <a
                href="#how"
                onClick={(e) => handleSectionClick(e, "how")}
                className={navLink}
              >
                <CogIcon className="w-4 h-4 text-[var(--color-accent-100)]" />
                <span>How it works</span>
              </a>

              

              <Link href="/services" className={navLink}>
                <Briefcase className="w-4 h-4 text-[var(--color-accent-100)]" />
                <span>Services</span>
              </Link>
            </nav>

            {/* Divider */}
            <div className="hidden md:block w-px h-6 bg-white/20" />

            {/* Auth buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className={`${btnBase} bg-white/8 border border-white/10 text-white/95 hover:bg-white/20`}
              >
                Login
              </Link>

              <Link
                href="/signup"
                className={`${btnBase} bg-[var(--color-accent-500)] text-[var(--color-primary-900)] hover:bg-[var(--color-accent-600)]`}
              >
                Sign up
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((s) => !s)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md bg-white/6 text-white/90"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="mt-3">
            <div className="bg-[var(--color-primary-900)]/95 text-white rounded-2xl px-4 py-4 shadow-md">
              <nav className="flex flex-col gap-2">
                <a
                  href="#features"
                  onClick={(e) => {
                    setMobileOpen(false);
                    handleSectionClick(e, "features");
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:text-[var(--color-accent-100)]"
                >
                  <FileText className="w-4 h-4 text-[var(--color-accent-100)]" />
                  Features
                </a>
                <a
                  href="#how"
                  onClick={(e) => {
                    setMobileOpen(false);
                    handleSectionClick(e, "how");
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:text-[var(--color-accent-100)]"
                >
                  <Scroll className="w-4 h-4 text-[var(--color-accent-100)]" />
                  How it works
                </a>
                
                <Link
                  href="/services"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:text-[var(--color-accent-100)]"
                >
                  <Briefcase className="w-4 h-4 text-[var(--color-accent-100)]" />
                  Services
                </Link>
                <div className="border-t border-white/10 mt-3 pt-3 flex flex-col gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 rounded-md text-sm bg-white/8 text-white"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="px-3 py-2 rounded-md text-sm bg-[var(--color-accent-500)] text-[var(--color-primary-900)]"
                  >
                    Sign up
                  </Link>
                </div>
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
