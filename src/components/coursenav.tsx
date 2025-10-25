"use client";

import React from "react";
import { Scale } from "lucide-react";

export default function TopNav() {
  return (
    <header className="w-full  -mt-2 -mb-8  ">
      <div className="max-w-10xl  mx-auto px-9 lg:px-11">
        <div
          className="
            bg-gradient-to-t from-indigo-950 via-indigo-900 to-indigo-800
           text-white shadow-lg rounded-b-3xl max-w-10xl 
            flex items-center justify-center
            px-6 py-6 
          "
          role="navigation"
          aria-label="Top Navigation"
        >
          {/* Brand: Icon + Text in a row */}
          <div className="flex items-center gap-3">
            <div
              className="rounded-full p-2"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
              }}
              aria-hidden
            >
              <Scale className="w-9 h-9 text-[var(--color-accent-400)] transition-transform duration-300" />
            </div>

            <div className="leading-tight text-left">
              <div className="font-semibold text-lg md:text-xl">LawCrafters</div>
              <div className="text-xs md:text-sm text-[rgba(255,255,255,0.85)]">
                Workplace legal &amp; compliance
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
