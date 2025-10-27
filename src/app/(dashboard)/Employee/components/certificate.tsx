// compliance_portal/src/components/Certificates.tsx
"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Award, Check, Eye, Copy } from "lucide-react";

// Each certificate row returned from /api/certificates
type CertificateRecord = {
  id: string;
  courseId: string;
  courseTitle?: string | null;
  url: string; // R2 public path or full URL
  issuedAt: string;
  learnerName?: string | null;
};

const R2_PUBLIC_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "") || "";

/* ------------------ Helpers ------------------ */
function resolveR2Url(value?: string | null) {
  if (value && typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return buildR2PublicUrl(""); // fallback to base handling
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed;
    if (trimmed.startsWith("/")) return trimmed;
    return buildR2PublicUrl(trimmed);
  }
  // if nothing provided return empty string (caller should handle)
  return "";
}

function buildR2PublicUrl(key: string) {
  if (!R2_PUBLIC_BASE) {
    // fallback root-relative filename (helpful in dev if asset in /public)
    return `/${key.split("/").pop()}`;
  }
  const cleanedKey = key.replace(/^\/+/, "");
  return `${R2_PUBLIC_BASE}/${encodeURI(cleanedKey)}`;
}

/* ------------------ Component ------------------ */
export default function Certificates(): JSX.Element {
  const [certs, setCerts] = useState<CertificateRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Get logged-in user (same approach as AssignedCoursesGrid)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        if (r.ok) {
          const j = await r.json().catch(() => null);
          const email = j?.email ?? j?.user?.email ?? null;
          if (mounted) setUserEmail(email);
          return;
        }
      } catch {}
      const local =
        typeof window !== "undefined"
          ? localStorage.getItem("userEmail") || localStorage.getItem("email") || null
          : null;
      if (mounted) setUserEmail(local);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch certificates for the resolved user (uses AbortController + mounted guard)
  useEffect(() => {
    if (!userEmail) {
      // still set loading until we either fetch or decide no user
      setCerts(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const url = `/api/certificates?email=${encodeURIComponent(userEmail)}&ts=${Date.now()}`;
        const res = await fetch(url, { credentials: "include", signal: controller.signal });
        if (!res.ok) {
          console.error("Failed to fetch certificates", res.status);
          if (!cancelled) setCerts([]);
          return;
        }
        const json = await res.json();
        const arr: CertificateRecord[] = Array.isArray(json) ? json : json?.certificates || json?.data || [];
        const normalized = arr.map((c) => ({
          ...c,
          url: c.url && (c.url.startsWith("http://") || c.url.startsWith("https://"))
            ? c.url
            : resolveR2Url(c.url),
        }));
        if (!cancelled) setCerts(normalized);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          // aborted: ignore
        } else {
          console.error("fetch certificates failed:", err);
          if (!cancelled) setCerts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userEmail]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Close preview on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePreview();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    return () => {
      // component unmount
      mountedRef.current = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewTitle(null);
  };

  // ---------- SVG style injection ----------
  function getEmbeddedStyle(): string {
    return `<![CDATA[
      svg { font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .title { font-size:44px; font-weight:700; fill:#0b1220; }
      .bigname { font-size:52px; font-weight:700; fill:#0b1220; }
      .course { font-size:36px; font-weight:700; fill:#0b1220; }
      .muted { font-size:16px; fill:#475569; }
      .issued { font-size:16px; fill:#475569; }
      .issuer { font-size:16px; fill:#0b1220; }
    ]]>`;
  }

  function injectStyleIntoSvgText(svgText: string): string {
    const styleTag = `<style type="text/css">${getEmbeddedStyle()}</style>`;
    const svgOpenMatch = svgText.match(/<svg[^>]*>/i);
    if (!svgOpenMatch) return `${styleTag}\n${svgText}`;
    const insertPos = svgOpenMatch.index! + svgOpenMatch[0].length;
    return `${svgText.slice(0, insertPos)}\n${styleTag}\n${svgText.slice(insertPos)}`;
  }

  // Fetch SVG, inject style, produce object URL
  async function fetchSvgAndMakeObjectUrl(srcUrl: string): Promise<{ objectUrl: string; svgText: string }> {
    // Use server-side proxy to avoid CORS issues:
    const proxyUrl = `/api/certificates/preview?url=${encodeURIComponent(srcUrl)}`;
    const res = await fetch(proxyUrl, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch SVG (${res.status})`);
    const text = await res.text();
    const styled = injectStyleIntoSvgText(text);
    const blob = new Blob([styled], { type: "image/svg+xml;charset=utf-8" });
    return { objectUrl: URL.createObjectURL(blob), svgText: styled };
  }

  // ---------- Actions ----------
  const handleView = async (c: CertificateRecord) => {
    try {
      setToast("Loading preview…");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const { objectUrl } = await fetchSvgAndMakeObjectUrl(c.url);
      setPreviewUrl(objectUrl);
      setPreviewTitle(c.courseTitle ?? c.courseId);
      setToast(null);
    } catch (err) {
      console.error("preview failed", err);
      setToast("Could not load preview");
    }
  };

  const handleDownload = async (c: CertificateRecord) => {
    try {
      setToast("Preparing download…");
      const { svgText } = await fetchSvgAndMakeObjectUrl(c.url);
      const filename = `${(c.courseTitle ?? c.courseId).replace(/\s+/g, "_")}_${c.id}.svg`;
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setToast("Download started");
    } catch (err) {
      console.error("download failed", err);
      setToast("Could not download");
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copied to clipboard");
    } catch {
      setToast("Copy failed");
    }
  };

  // ---------- Render ----------
  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4 text-slate-900">Certificates</h2>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : !certs?.length ? (
          <div className="text-sm text-slate-500">You don't have any saved certificates yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {certs.map((c) => (
              <motion.div
                key={c.id}
                whileHover={{ scale: 1.01 }}
                className="relative p-4 rounded-2xl border bg-gradient-to-t from-white to-slate-50 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 grid place-items-center w-14 h-14 rounded-lg bg-gradient-to-b from-indigo-50 to-indigo-100 border border-indigo-100">
                    <Award className="w-6 h-6 text-amber-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {c.courseTitle ?? c.courseId}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          <span>Verified</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 mt-1">Issued: {new Date(c.issuedAt).toLocaleDateString()}</div>

                    <div className="text-xs text-slate-400 mt-2 flex items-center gap-2">
                      <span className="font-mono text-xs truncate">{c.id}</span>
                      <button
                        onClick={() => copyToClipboard(c.id)}
                        title="Copy certificate ID"
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleView(c)}
                        className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>

                      <button
                        onClick={() => handleDownload(c)}
                        className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                      >
                        <Download className="w-4 h-4" /> Download
                      </button>

                      <a href={c.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-slate-500 hover:text-slate-700">
                        Open in new tab
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-1000 flex items-center justify-center p-4" onClick={closePreview}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="text-sm font-semibold">{previewTitle}</div>
                <div className="text-xs text-slate-500">Certificate preview</div>
              </div>
              <button onClick={closePreview} className="text-sm px-3 py-1 rounded-md border border-slate-100 hover:bg-slate-50">
                Close
              </button>
            </div>
            <div className="p-4 h-full">
              <iframe title="certificate-preview" src={previewUrl} className="w-full h-full border-none" />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-6 bottom-6 z-50">
          <div className="rounded-md bg-slate-900 text-white px-4 py-2 shadow">{toast}</div>
        </div>
      )}
    </div>
  );
}
