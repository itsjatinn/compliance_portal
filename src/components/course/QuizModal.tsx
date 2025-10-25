// compliance_portal/src/components/course/QuizModal.tsx
"use client";

import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { X } from "lucide-react";
import * as utils from "../../lib/courseUtils";

export default function QuizModal({
  activeQuiz,
  onClose,
  onSubmit,
  userAnswers,
  setUserAnswers,
  activeQuizResult,
  quizReports,
  disablePortal,
}: {
  activeQuiz: { meta: any; quiz: any };
  onClose: () => void;
  onSubmit: (meta: any, quiz: any, answers: Record<string, any>) => void;
  userAnswers: Record<string, any>;
  setUserAnswers: (u: Record<string, any>) => void;
  activeQuizResult: any;
  quizReports: Record<string, any>;
  disablePortal?: boolean;
}) {
  const quiz = activeQuiz.quiz;
  const meta = activeQuiz.meta;
  const quizId =
    meta.__quizId ?? String(quiz?.id ?? `${meta.__sectionId}_quiz_${meta.originalIndex}`);
  const questions =
    Array.isArray(quiz?.questions) && quiz.questions.length > 0 ? quiz.questions : null;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onChangeAnswer = (key: string, value: any) => {
    setUserAnswers({ ...(userAnswers ?? {}), [key]: value });
  };

  useEffect(() => {
    containerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = () => {
    onSubmit(meta, quiz, userAnswers ?? {});
  };

  const pastelBg = (i: number) => {
    const classes = [
      "bg-[#CFFFE6]", // mint
      "bg-[#EEF9B8]", // light lime
      "bg-[#FFD8A8]", // peach
      "bg-[#FFB6B6]", // soft pink
    ];
    return classes[i % classes.length];
  };

  const modalContent = (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-7">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div
        ref={containerRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-xl rounded-2xl shadow-2xl bg-indigo-950 text-white overflow-hidden"
      >
        {/* header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold">Quiz</h2>
            <p className="text-sm text-white/70">
              Appears at {meta?.appearAt != null ? `${meta.appearAt}s` : "during lesson"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* questions */}
        <div className="p-6 space-y-5">
          {questions ? (
            questions.map((q: any, qi: number) => {
              const qKey = `q_${qi}`;
              const qText = utils.getQuestionText(q, `Q${qi + 1}`);
              const rawOpts =
                q?.options ??
                q?.choices ??
                q?.answers ??
                utils.normalizeOptions(q?.options ?? q?.choices ?? q?.answers ?? "");
              const opts = Array.isArray(rawOpts) ? rawOpts : [];

              return (
                <div key={qKey} className="p-5 bg-indigo-900 rounded-xl border border-indigo-800 shadow-md">
                  <div className="text-base font-semibold mb-4 text-white/90">
                    {qText}
                  </div>
                  <div className="space-y-3">
                    {opts.map((o: any, oi: number) => {
                      const val = utils.getOptionValue(o, oi);
                      const label = utils.getOptionLabel(o);
                      const checked = String(userAnswers[qKey] ?? "") === String(val);

                      return (
                        <label
                          key={oi}
                          className={`flex items-center gap-3 cursor-pointer select-none rounded-full px-5 py-3 font-medium shadow-sm transition ${
                            pastelBg(oi)
                          } ${checked ? "ring-2 ring-amber-400 scale-[1.02]" : "hover:scale-[1.01]"}`}
                        >
                          <input
                            type="radio"
                            name={qKey}
                            value={val}
                            checked={checked}
                            onChange={() => onChangeAnswer(qKey, val)}
                            className="hidden"
                          />
                          <span className="flex-1 text-indigo-950 text-sm">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-5 bg-indigo-900 rounded-xl border border-indigo-800 shadow-md">
              <div className="text-base font-semibold mb-4 text-white/90">
                {utils.getQuestionText(quiz, "Answer this:")}
              </div>
              {Array.isArray(quiz?.options) ? (
                <div className="space-y-3">
                  {quiz.options.map((o: any, i: number) => {
                    const val = utils.getOptionValue(o, i);
                    const label = utils.getOptionLabel(o);
                    const checked = String(userAnswers["single"] ?? "") === String(val);
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-3 cursor-pointer select-none rounded-full px-5 py-3 font-medium shadow-sm transition ${
                          pastelBg(i)
                        } ${checked ? "ring-2 ring-amber-400 scale-[1.02]" : "hover:scale-[1.01]"}`}
                      >
                        <input
                          type="radio"
                          name="single"
                          value={val}
                          checked={checked}
                          onChange={() => onChangeAnswer("single", val)}
                          className="hidden"
                        />
                        <span className="flex-1 text-indigo-950 text-sm">{label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={userAnswers["single"] ?? ""}
                  onChange={(e) => onChangeAnswer("single", e.target.value)}
                  className="w-full border border-indigo-700 rounded-md px-4 py-2 bg-indigo-900 text-white/90"
                  placeholder="Type your answer"
                />
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-indigo-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-indigo-800 text-white/80 hover:bg-indigo-700 text-sm"
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm transition"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );

  if (disablePortal) return modalContent;
  if (typeof document === "undefined") return modalContent;
  return ReactDOM.createPortal(modalContent, document.body);
}
