// src/app/(dashboard)/admin/components/UploadProgressModal.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function UploadProgressModal({
  open,
  percent,
  message,
  onClose,
  autoFill = false,
  autoCloseDelay = 400,
}: {
  open: boolean;
  percent?: number;
  message?: string | null;
  onClose?: () => void;
  autoFill?: boolean;
  autoCloseDelay?: number;
}) {
  // displayedPercent is always 0..100
  const clamp = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
  const [displayedPercent, setDisplayedPercent] = useState<number>(0);
  const closingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);

  // When percent prop is provided, just clamp & animate to it (Framer Motion handles smoothness)
  useEffect(() => {
    if (!open) {
      setDisplayedPercent(0);
      closingRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTs.current = null;
      return;
    }

    if (typeof percent === "number") {
      setDisplayedPercent(clamp(percent));
      // no RAF loop needed — framer will animate width smoothly
      return;
    }

    // fallback: if autoFill true and no external percent, do a gentle auto-increment
    if (autoFill) {
      const step = (ts: number) => {
        if (lastTs.current == null) lastTs.current = ts;
        const dt = Math.min(100, ts - (lastTs.current ?? ts));
        lastTs.current = ts;

        setDisplayedPercent((prev) => {
          // small incremental growth; never hit 100 instantly
          const increment = Math.max(0.2, (0.04 + (prev / 100) * 0.6) * (dt / 16));
          const next = Math.min(99.5, Math.round((prev + increment) * 100) / 100); // intentionally avoid hitting 100
          return next;
        });

        rafRef.current = requestAnimationFrame(step);
      };

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(step);

      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTs.current = null;
      };
    }
  }, [open, percent, autoFill]);

  // auto-close when we reach 100%
  useEffect(() => {
    if (!open) return;
    if (displayedPercent >= 100 && !closingRef.current) {
      closingRef.current = true;
      const id = setTimeout(() => {
        onClose?.();
        closingRef.current = false;
      }, autoCloseDelay);
      return () => clearTimeout(id);
    }
  }, [displayedPercent, open, onClose, autoCloseDelay]);

  const shown = Math.round(clamp(displayedPercent));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-6"
        >
          <div className="absolute inset-0 bg-black/50" />
          <motion.div
            initial={{ y: 18, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 12, scale: 0.98 }}
            className="relative z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Uploading</h3>
                <div className="text-xs text-slate-500 mt-1">{message ?? "Uploading — please wait."}</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  // animate width 0..100
                  animate={{ width: `${clamp(displayedPercent)}%` }}
                  transition={{ ease: "easeOut", duration: 0.35 }}
                  className="h-full rounded-full bg-linear-to-r from-indigo-500 to-violet-500"
                  style={{ width: `${clamp(displayedPercent)}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <div>{shown}%</div>
                <div>{shown >= 100 ? "Done" : "Uploading..."}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
