// compliance_portal/src/components/certificates/Certificates.tsx
"use client";

import React, { JSX, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Award, Check, Eye, Copy } from "lucide-react";

type CertificateRecord = {
  id: string;
  courseId: string;
  courseTitle?: string | null;
  url: string; // public path to svg (e.g. /certificates/...)
  issuedAt: string;
  learnerName?: string | null;
};

export default function Certificates(): JSX.Element {
  const [certs, setCerts] = useState<CertificateRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // preview modal state (previewUrl is a safe object URL we create after injecting styles)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/certificates", { credentials: "include" });
        if (!mounted) return;
        if (!res.ok) {
          setCerts([]);
        } else {
          const json = await res.json();
          setCerts(Array.isArray(json) ? json : []);
        }
      } catch (err) {
        console.error("fetch certificates failed", err);
        setCerts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // close preview on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePreview();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // helper - ensure safe object URL cleanup
  const closePreview = () => {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
    }
    setPreviewUrl(null);
    setPreviewTitle(null);
  };

  // Styles to inject into the SVG so it looks like your designed certificate.
  // You can modify fonts/colors here as needed. If you want to embed a custom webfont,
  // we'll need to add an @font-face with base64 font data — ask if you want that.
  function getEmbeddedStyle(): string {
    // Use CDATA to avoid conflicts with XML parsing
    return `<![CDATA[
      svg { font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0b1220; }
      .bg { fill: #0b1220; }
      .panel { fill: #ffffff; rx: 16; }
      .accent { fill: url(#g1); opacity: 0.08; }
      .title { font-family: Georgia, "Times New Roman", serif; font-size:44px; fill:#0b1220; font-weight:700; }
      .bigname { font-family: Georgia, "Times New Roman", serif; font-size:52px; fill:#0b1220; font-weight:700; }
      .course { font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size:36px; fill:#0b1220; font-weight:700; }
      .muted { font-size:16px; fill:#475569; }
      .small { font-size:12px; fill:#64748b; }
      .issued { font-size:16px; fill:#475569; }
      .issuer { font-size:16px; fill:#0b1220; }
    ]]>`;
  }

  // Inject <style> just after the opening <svg ...> tag. If the SVG already has a <style>, we prepend ours.
  function injectStyleIntoSvgText(svgText: string): string {
    if (!svgText) return svgText;
    // quick sanity: ensure it's an SVG string
    const low = svgText.slice(0, 1000).toLowerCase();
    if (!low.includes("<svg")) {
      return svgText;
    }

    // Build style tag
    const styleTag = `<style type="text/css">${getEmbeddedStyle()}</style>`;

    // If there's already a <style> tag close to start, we try injecting inside <svg> but before any existing <defs> or content.
    // Find position after opening <svg ...>
    const svgOpenMatch = svgText.match(/<svg[^>]*>/i);
    if (!svgOpenMatch) {
      // fallback: prepend style
      return `${styleTag}\n${svgText}`;
    }

    const insertPos = svgOpenMatch.index! + svgOpenMatch[0].length;

    // Insert the style tag at insertPos
    const before = svgText.slice(0, insertPos);
    const after = svgText.slice(insertPos);
    return `${before}\n${styleTag}\n${after}`;
  }

  // Convert fetched SVG text to an object URL after injecting styles
  async function fetchSvgAndMakeObjectUrl(srcUrl: string): Promise<{ objectUrl: string; svgText: string }>{
    // fetch as text
    const res = await fetch(srcUrl, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to fetch SVG (${res.status})`);
    const text = await res.text();

    const styled = injectStyleIntoSvgText(text);
    const blob = new Blob([styled], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    return { objectUrl: url, svgText: styled };
  }

  // Called when the user clicks "View"
  const handleView = async (c: CertificateRecord) => {
    try {
      setToast("Loading preview…");
      // revoke previous preview url
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch {}
      }

      const { objectUrl } = await fetchSvgAndMakeObjectUrl(c.url);
      setPreviewUrl(objectUrl);
      setPreviewTitle(c.courseTitle ?? c.courseId);
      setToast(null);
    } catch (err: any) {
      console.error("preview failed", err);
      setToast("Could not load preview");
    }
  };

  // Called when the user clicks Download (we fetch, inject styles, then download).
  const handleDownload = async (c: CertificateRecord) => {
    try {
      setToast("Preparing download…");
      const { svgText } = await fetchSvgAndMakeObjectUrl(c.url);
      const filename = `${(c.courseTitle ?? c.courseId).replace(/\s+/g, "_")}_${c.id}.svg`;
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
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

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4 text-slate-900">Certificates</h2>

      {/* Only certificates grid (full width) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : !certs || certs.length === 0 ? (
          <div className="text-sm text-slate-500">You don't have any saved certificates yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {certs.map((c) => (
              <motion.div
                key={c.id}
                whileHover={{ scale: 1.01 }}
                className="relative p-4 rounded-2xl border bg-gradient-to-tr from-white to-slate-50 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 grid place-items-center w-14 h-14 rounded-lg bg-gradient-to-b from-indigo-50 to-indigo-100 border border-indigo-100">
                    <Award className="w-6 h-6 text-amber-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.courseTitle ?? c.courseId}</div>
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
                        aria-label={`Copy certificate id ${c.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleView(c)}
                        className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                        aria-label={`View certificate ${c.id}`}
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>

                      <button
                        onClick={() => handleDownload(c)}
                        className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                        aria-label={`Download certificate ${c.id}`}
                      >
                        <Download className="w-4 h-4" /> Download
                      </button>

                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-xs text-slate-500 hover:text-slate-700"
                      >
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
        <div
          className="fixed inset-0 z-1000 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview certificate ${previewTitle ?? ""}`}
          onClick={closePreview}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <div className="text-sm font-semibold">{previewTitle}</div>
                <div className="text-xs text-slate-500">Certificate preview</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    // download styled SVG currently in previewUrl
                    try {
                      setToast("Preparing download…");
                      // fetch the object url and turn into blob for download
                      const resp = await fetch(previewUrl);
                      const blob = await resp.blob();
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${(previewTitle ?? "certificate").replace(/\s+/g, "_")}.svg`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setToast("Download started");
                    } catch (err) {
                      console.error(err);
                      setToast("Download failed");
                    }
                  }}
                  className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-amber-400 text-indigo-900 hover:bg-amber-500"
                >
                  <Download className="w-4 h-4" /> Download
                </button>

                <button
                  onClick={closePreview}
                  className="text-sm px-3 py-1 rounded-md border border-slate-100 hover:bg-slate-50"
                  aria-label="Close preview"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 h-full">
              <iframe
                title="certificate-large-preview"
                src={previewUrl}
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed right-6 bottom-6 z-50">
          <div className="rounded-md bg-slate-900 text-white px-4 py-2 shadow">{toast}</div>
        </div>
      )}
    </div>
  );
}
