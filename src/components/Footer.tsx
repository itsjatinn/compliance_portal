"use client";

import { Scale, Facebook, Twitter, Linkedin } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full -mt-8 px-10  lg:px-10">
      {/* Gradient background with rounded top only */}
      <div className="bg-linear-to-t rounded-t-3xl from-indigo-950 to-indigo-900 text-white shadow-inner overflow-hidden">
        <div className="max-w-7xl mx-auto py-10 flex flex-col md:flex-row items-center justify-between gap-6 px-6 lg:px-12">
          
          {/* Logo + Tagline */}
          {/* <div className="flex items-center gap-3 text-center md:text-left">
            <div
              className="rounded-full p-2"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <Scale className="w-7 h-7 text-[var(--color-accent-400)]" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-lg md:text-xl">LawCrafters</div>
              <div className="text-xs md:text-sm text-white/80">
                Workplace legal &amp; compliance
              </div>
            </div>
          </div> */}

          {/* Navigation Links */}
          <nav className="flex space-x-6 text-sm md:text-base">
            <Link href="/about" className="text-white hover:text-(--color-accent-400)">
              About
            </Link>
            <Link href="/services" className="text-white hover:text-(--color-accent-400)">
              Services
            </Link>
            <Link href="/contact" className="text-white hover:text-(--color-accent-400)">
              Contact
            </Link>
          </nav>

          {/* Social Icons */}
          <div className="flex space-x-5">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-(--color-accent-400)"
              aria-label="Facebook"
            >
              <Facebook size={20} />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-(--color-accent-400)"
              aria-label="Twitter"
            >
              <Twitter size={20} />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-(--color-accent-400)"
              aria-label="LinkedIn"
            >
              <Linkedin size={20} />
            </a>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="border-t border-white/20 py-4 text-center text-xs md:text-sm text-white/70">
          © {new Date().getFullYear()} ZaroHR. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
