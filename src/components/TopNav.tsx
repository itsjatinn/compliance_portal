"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Scale,
  FileText,
  BookOpen,
  Scroll,
  Briefcase,
  Menu,
  CogIcon,
  X
} from "lucide-react";

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

  // restored animated nav link style
  const navLink =
  "flex items-center gap-2 px-5 py-2 rounded-md text-m whitespace-nowrap transition-all duration-300 hover:gap-1 text-white hover:text-[var(--color-accent-400)]";

  return (
    <header className="w-full -mt-5 -mb-10 z-50">
      <div className="max-w-10xl mx-auto px-9 lg:px-11">
        <div
          className="
            bg-gradient-to-t from-[var(--color-primary-900)] to-[var(--color-primary-800)]
            text-white shadow-lg rounded-3xl max-w-10xl 
            flex items-center justify-between gap-6
            px-6 py-3 pr-10 pl-10 pt-10 pb-8
          "
          role="navigation"
          aria-label="Top Navigation"
        >
          {/* Brand on left */}
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="rounded-full p-2"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
              }}
              aria-hidden
            >
              <Scale className="w-7 h-7 text-[var(--color-accent-400)] transition-transform duration-300 group-hover:scale-110" />
            </div>

            <div className="leading-tight">
              <div className="font-semibold text-lg md:text-xl">LawCrafters</div>
              <div className="text-xs md:text-sm text-[rgba(255,255,255,0.85)]">
                Workplace legal &amp; compliance
              </div>
            </div>
          </div>

          {/* Nav links + actions grouped to the right */}
          <div className="flex items-center gap-4">
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-2">
              <a
                href="#features"
                onClick={(e) => handleSectionClick(e, "features")}
                className={navLink}
              >
                <FileText className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 text-[var(--color-accent-100)]" />
                <span>Features</span>
              </a>

              <a
                href="#how"
                onClick={(e) => handleSectionClick(e, "how")}
                className={navLink}
              >
                <CogIcon className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 text-[var(--color-accent-100)]" />
                <span>How it works</span>
              </a>

              <Link href="/Employee" className={navLink}>
                <BookOpen className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 text-[var(--color-accent-100)]" />
                <span>Courses</span>
              </Link>

              <Link href="/services" className={navLink}>
                <Briefcase className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 text-[var(--color-accent-100)]" />
                <span>Services</span>
              </Link>
            </nav>

            {/* Divider */}
            <div className="hidden md:block w-px h-6 bg-white/20" />

            {/* Login / Signup */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className={`${btnBase} bg-white/8 backdrop-blur-sm border border-white/10 text-white/95 hover:bg-white/20`}
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

            {/* mobile menu toggle */}
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
                  onClick={(e) => { setMobileOpen(false); handleSectionClick(e, "features"); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:text-[var(--color-accent-100)]"
                >
                  <FileText className="w-4 h-4 text-[var(--color-accent-100)]" />
                  Features
                </a>
                <a
                  href="#how"
                  onClick={(e) => { setMobileOpen(false); handleSectionClick(e, "how"); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:text-[var(--color-accent-100)]"
                >
                  <Scroll className="w-4 h-4 text-[var(--color-accent-100)]" />
                  How it works
                </a>
                <Link href="/courses" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:text-[var(--color-accent-100)]">
                  <BookOpen className="w-4 h-4 text-[var(--color-accent-100)]" />
                  Courses
                </Link>
                <Link href="/services" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:text-[var(--color-accent-100)]">
                  <Briefcase className="w-4 h-4 text-[var(--color-accent-100)]" />
                  Services
                </Link>
                <div className="border-t border-white/10 mt-3 pt-3 flex flex-col gap-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md text-sm bg-white/8 text-white">
                    Login
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-md text-sm bg-[var(--color-accent-500)] text-[var(--color-primary-900)]">
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
