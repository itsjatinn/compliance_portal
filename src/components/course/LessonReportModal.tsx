// compliance_portal/src/components/course/LessonReportModal.tsx
"use client";

import React from "react";
import { X, Calendar, Clock } from "lucide-react";

export default function LessonReportModal({
  reports = [],
  onClose,
}: {
  reports?: any[];
  onClose: () => void;
}) {
  const totalScore = (reports || []).reduce((s: number, r: any) => s + (r.score || 0), 0);
  const totalMax = (reports || []).reduce((s: number, r: any) => s + (r.maxScore || 0), 0);
  const overallPercent = totalMax ? Math.round((totalScore / totalMax) * 100) : 0;

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-auto z-10 max-h-[85vh] border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <div className="text-lg font-semibold text-slate-900">Lesson Quiz Report</div>
            <div className="text-xs text-slate-500 mt-1">Saved attempts & granular question feedback</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100">
              <div className="text-xs text-slate-600">Overall</div>
              <div className="text-sm font-semibold text-slate-900 pl-1">{overallPercent}%</div>
            </div>

            <button
              onClick={onClose}
              aria-label="Close report"
              className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-100 shadow-sm"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Top summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-2 p-4 bg-gradient-to-r from-white to-slate-50 rounded-xl border border-slate-100 shadow-sm">
              <div className="text-xs text-slate-500">Total Score</div>
              <div className="mt-2 flex items-center gap-4">
                <div className="text-2xl font-bold text-slate-900">
                  {totalScore} <span className="text-base font-medium text-slate-500">/ {totalMax}</span>
                </div>
                <div className="text-sm text-slate-600">Aggregated from {reports.length} attempt{reports.length !== 1 && "s"}</div>
              </div>
              <div className="mt-3 text-xs text-slate-500 flex items-center gap-3">
                <Calendar className="w-4 h-4" />
                <span>Latest attempt: {formatDate(reports[0]?.createdAt ?? reports[0]?.created ?? null)}</span>
              </div>
            </div>

            {/* Circular percent */}
            <div className="flex items-center justify-center p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
              <div
                aria-hidden
                className="relative flex items-center justify-center"
                style={{ width: 96, height: 96 }}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: 96,
                    height: 96,
                    background: `conic-gradient(#52c41a ${overallPercent * 3.6}deg, #f3f4f6 ${overallPercent * 3.6}deg)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "inset 0 -6px 18px rgba(0,0,0,0.03)",
                  }}
                >
                  <div className="bg-white rounded-full w-20 h-20 flex flex-col items-center justify-center">
                    <div className="text-sm font-semibold text-slate-900">{overallPercent}%</div>
                    <div className="text-xs text-slate-500">Correct</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Per-quiz reports */}
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-50 text-slate-600 border border-dashed border-slate-100">
                No quiz attempts recorded for this lesson.
              </div>
            ) : (
              reports.map((r: any, i: number) => {
                const details = r.details ?? [];
                const percent = typeof r.percent === "number" ? r.percent : r.maxScore ? Math.round((r.score / r.maxScore) * 100) : 0;
                const quizNumber = i + 1;

                return (
                  <div key={`${r.quizId ?? quizNumber}-${i}`} className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 font-semibold">
                          Q{quizNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate">
                            {r.title ?? `Quiz ${quizNumber}`}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Attempted {formatDate(r.createdAt ?? r.attemptedAt ?? r.created ?? null)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-sm font-medium text-slate-900">{r.score} / {r.maxScore}</div>
                        <div className="text-xs text-slate-500">Result</div>
                      </div>
                    </div>

                    

                    {/* question details */}
                    <div className="mt-4 grid gap-3">
                      {(details.length === 0) ? (
                        <div className="text-xs text-slate-500">No per-question details available.</div>
                      ) : (
                        details.map((d: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${
                              d.isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-900">{d.question ?? `Question ${idx + 1}`}</div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Your answer: <span className="font-medium">{String(d.selected ?? "—")}</span>
                                  <span className="ml-3 text-slate-400">Correct: <span className="font-medium">{String(d.correct ?? "—")}</span></span>
                                </div>
                              </div>
                              <div className="ml-3 flex-shrink-0">
                                <div
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                    d.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {d.isCorrect ? "Correct" : "Incorrect"}
                                </div>
                              </div>
                            </div>
                            {d.explanation && (
                              <div className="mt-2 text-xs text-slate-500">
                                Explanation: {d.explanation}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
