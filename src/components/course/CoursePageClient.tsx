// compliance_portal/src/components/course/CoursePageClient.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import TopNav from "../coursenav";
import { Play, Pause, Maximize, Minimize, CheckCircle } from "lucide-react";
import QuizModal from "./QuizModal";
import LessonReportModal from "./LessonReportModal";

/* ------------------ R2 CONFIG ------------------ */
// Use the same R2 logic as in AssignedCoursesGrid.tsx
const R2_PUBLIC = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");
const R2_DEFAULT_THUMB_KEY = "thumbnails/5994373.jpg";

// Helper: Build R2 public URL safely
function buildR2PublicUrl(key: string) {
  if (!R2_PUBLIC) return `/${key.split("/").pop()}`;
  const cleanedKey = key.replace(/^\/+/, "");
  return `${R2_PUBLIC}/${encodeURI(cleanedKey)}`;
}

// Helper: Resolve R2 URL for videos or images
function resolveR2Url(value?: string | null) {
  if (!value) return buildR2PublicUrl(R2_DEFAULT_THUMB_KEY);
  const trimmed = String(value).trim();
  if (!trimmed) return buildR2PublicUrl(R2_DEFAULT_THUMB_KEY);
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return buildR2PublicUrl(trimmed);
}

/* ------------------ Helpers ------------------ */

function parseTimeToSeconds(input: any): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.max(0, Math.floor(input));
  }
  const s = String(input).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));
  const numUnit = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|secs?)$/i);
  if (numUnit) return Math.round(parseFloat(numUnit[1]));
  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  }
  const num = Number(s.replace(/[^\d.-]/g, ""));
  if (!Number.isNaN(num) && isFinite(num)) return Math.round(num);
  return null;
}

function splitOptionString(s: string): string[] {
  if (!s) return [];
  const separators = [";", "|", ","];
  for (const sep of separators) {
    if (s.includes(sep)) {
      return s
        .split(sep)
        .map((p) => p.trim())
        .filter(Boolean);
    }
  }
  return s
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function normalizeOptions(opts: any): any[] | undefined {
  if (opts == null) return undefined;
  if (Array.isArray(opts)) {
    const allObjects = opts.every((it) => it && typeof it === "object");
    if (allObjects) return opts;
    const flattened: any[] = [];
    opts.forEach((el) => {
      if (typeof el === "string") {
        const parts = splitOptionString(el);
        parts.forEach((p) => flattened.push(p));
      } else if (el && typeof el === "object") {
        flattened.push(el);
      } else {
        flattened.push(String(el));
      }
    });
    return flattened;
  }
  if (typeof opts === "string") return splitOptionString(opts);
  if (typeof opts === "object") return [opts];
  return [String(opts)];
}

function getOptionValue(opt: any, idx?: number) {
  if (opt == null) return `__opt_null_${idx ?? 0}`;
  if (typeof opt === "string") return opt;
  if (typeof opt === "number") return String(opt);
  if (typeof opt === "object") {
    if (opt.value != null) return String(opt.value);
    if (opt.id != null) return String(opt.id);
    if (opt.name != null) return String(opt.name);
    if (opt.option != null) return String(opt.option);
    if (opt.label != null) return String(opt.label);
    try {
      return JSON.stringify(opt);
    } catch {
      return `__opt_obj_${idx ?? 0}`;
    }
  }
  return String(opt);
}

/* defensive extractor */
function extractQuizzesFromLesson(lessonObj: any): any[] {
  if (!lessonObj) return [];
  const candidates = [
    lessonObj.quizzes,
    lessonObj.quiz,
    lessonObj.questions,
    lessonObj.questionList,
    lessonObj.assessments,
    lessonObj.assessment,
    lessonObj.quizQuestions,
    lessonObj.questionsList,
    lessonObj.questions_list,
    lessonObj.content?.quiz,
    lessonObj.content?.quizzes,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === "object" && !Array.isArray(c)) return Object.values(c);
  }
  if (lessonObj.type === "quiz") return [lessonObj];
  const nestedKeys = ["data", "payload", "lesson", "content", "body"];
  for (const k of nestedKeys) {
    if (lessonObj[k]) {
      const found = extractQuizzesFromLesson(lessonObj[k]);
      if (found && found.length) return found;
    }
  }

  const foundArrays: any[] = [];
  const visited = new Set<any>();
  const looksLikeQuizItem = (item: any) => {
    if (!item || typeof item !== "object") return false;
    const keys = Object.keys(item).map((kk) => kk.toLowerCase());
    if (
      keys.includes("question") ||
      keys.includes("prompt") ||
      keys.includes("options") ||
      keys.includes("answer") ||
      keys.includes("appearat") ||
      keys.includes("time") ||
      keys.includes("appear_at") ||
      keys.includes("start")
    ) {
      return true;
    }
    return false;
  };

  const walk = (o: any, depth = 0) => {
    if (!o || depth > 6) return;
    if (visited.has(o)) return;
    visited.add(o);
    if (Array.isArray(o)) {
      if (o.length > 0 && o.every((el) => typeof el === "object")) {
        if (o.some((el) => looksLikeQuizItem(el))) foundArrays.push(o);
      }
      o.forEach((el) => walk(el, depth + 1));
      return;
    }
    if (typeof o === "object") {
      Object.values(o).forEach((v) => walk(v, depth + 1));
    }
  };

  walk(lessonObj, 0);
  if (foundArrays.length > 0) return foundArrays[0];
  return [];
}

/* fallback: scan text for a "quizzes": [ ... ] JSON array and parse it */
function findQuizzesByScanning(lessonObj: any): any[] {
  try {
    const text = JSON.stringify(lessonObj);
    const key = `"quizzes"`;
    const idx = text.indexOf(key);
    if (idx === -1) return [];
    const after = text.indexOf("[", idx);
    if (after === -1) return [];
    let depth = 0;
    let endIdx = -1;
    for (let i = after; i < text.length; i++) {
      const ch = text[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx === -1) return [];
    const arrText = text.slice(after, endIdx + 1);
    try {
      const arr = JSON.parse(arrText);
      if (Array.isArray(arr)) return arr;
      return [];
    } catch (e) {
      try {
        const unescaped = arrText.replace(/\\"/g, '"');
        const arr = JSON.parse(unescaped);
        if (Array.isArray(arr)) return arr;
      } catch (e2) {}
    }
  } catch (e) {}
  return [];
}

/* UI helpers */
function formatTime(sec: number | null | undefined) {
  if (sec == null || !isFinite(sec) || sec <= 0) return "00:00";
  const s = Math.floor(sec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0)
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/* ---------- Types ---------- */
type Section = {
  id: string;
  title: string;
  duration?: number | string | null;
  videoUrl?: string | null;
  resourceUrl?: string | null;
  lesson?: any;
  [k: string]: any;
};

type Course = {
  id: string;
  title?: string;
  introVideo?: string | null;
  sections?: Section[];
  [k: string]: any;
};

/* ---------- Component ---------- */

export default function CoursePageClient({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  const [watchedSections, setWatchedSections] = useState<Record<string, boolean>>({});
  const [quizPassed, setQuizPassed] = useState<Record<string, boolean>>({});
  const [quizReports, setQuizReports] = useState<Record<string, any>>({});
  const [timedQuizzes, setTimedQuizzes] = useState<Record<string, any[]>>({});

  // new refs to track attempts and failures per section
  const attemptedQuizzesRef = useRef<Record<string, Set<string>>>({});
  const failedQuizzesRef = useRef<Record<string, Set<string>>>({});

  // modal states
  const [activeQuiz, setActiveQuiz] = useState<null | { meta: any; quiz: any }>(null);
  const [activeQuizResult, setActiveQuizResult] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSectionId, setReportSectionId] = useState<string | null>(null);

  const currentSectionRef = useRef<string>("intro");
  const initialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<any | null>(null);
  const mountedRef = useRef(true);

  // shown timed quizzes per section (Set of quizIds)
  const shownTimedQuizzesRef = useRef<Record<string, Set<string>>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ---------- Load course & build timed quizzes (deep parse + fallback) ---------- */
  useEffect(() => {
    let cancelled = false;

    function deepParseJsonStrings(obj: any, depth = 0, maxDepth = 8) {
      if (obj == null || depth > maxDepth) return obj;
      if (typeof obj !== "object") {
        if (typeof obj === "string") {
          const trimmed = obj.trim();
          if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
            try {
              const parsed = JSON.parse(trimmed);
              return deepParseJsonStrings(parsed, depth + 1, maxDepth);
            } catch (e) {
              try {
                const unquoted = trimmed.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
                if ((unquoted.startsWith("{") && unquoted.endsWith("}")) || (unquoted.startsWith("[") && unquoted.endsWith("]"))) {
                  return deepParseJsonStrings(JSON.parse(unquoted), depth + 1, maxDepth);
                }
              } catch (e2) {}
              return obj;
            }
          }
        }
        return obj;
      }

      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          try {
            obj[i] = deepParseJsonStrings(obj[i], depth + 1, maxDepth);
          } catch {}
        }
        return obj;
      }

      const keys = Object.keys(obj);
      for (const k of keys) {
        try {
          const val = obj[k];
          if (typeof val === "string") {
            const trimmed = val.trim();
            if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
              try {
                obj[k] = deepParseJsonStrings(JSON.parse(trimmed), depth + 1, maxDepth);
                continue;
              } catch (e) {
                try {
                  const unquoted = trimmed.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
                  if ((unquoted.startsWith("{") && unquoted.endsWith("}")) || (unquoted.startsWith("[") && unquoted.endsWith("]"))) {
                    obj[k] = deepParseJsonStrings(JSON.parse(unquoted), depth + 1, maxDepth);
                    continue;
                  }
                } catch (e2) {}
              }
            }
          } else if (typeof val === "object" && val !== null) {
            obj[k] = deepParseJsonStrings(val, depth + 1, maxDepth);
          }
        } catch (e) {}
      }
      return obj;
    }

    (async () => {
      try {
        setLoadError(null);
        let found: any = null;
        try {
          const r = await fetch(`/api/course/${encodeURIComponent(courseId)}`, { credentials: "include" });
          if (r.ok) {
            const j = await r.json();
            found = j?.course ?? j ?? null;
            if (j?.ok && j?.course) found = j.course;
          }
        } catch (e) {
          console.debug("course fetch failed", e);
        }

        if (!found) {
          try {
            const resp = await fetch("/api/admin/courses", { credentials: "include" });
            if (resp.ok) {
              const data = await resp.json();
              const all = Array.isArray(data) ? data : data?.courses ?? [];
              found = all.find((c: any) => c.id === courseId);
            }
          } catch (e) {
            console.debug("admin courses fetch failed", e);
          }
        }

        if (!found) {
          if (!cancelled) {
            setCourse(null);
            setLoadError("Course not found");
          }
          return;
        }

        const lessonsCandidate = Array.isArray(found.sections)
          ? found.sections
          : Array.isArray(found.courseLessons)
          ? found.courseLessons
          : Array.isArray(found.lessons)
          ? found.lessons
          : [];

        const sections: Section[] =
          (Array.isArray(lessonsCandidate)
            ? lessonsCandidate.map((lesson: any, idx: number) => {
                let l: any;
                try {
                  l = lesson ? JSON.parse(JSON.stringify(lesson)) : {};
                } catch {
                  l = lesson ?? {};
                }
                try {
                  deepParseJsonStrings(l);
                } catch (e) {
                  console.debug("deepParseJsonStrings failed", e);
                }

                const id = String(
                  l.id ?? l._id ?? l.uuid ?? l.lessonId ?? l.uid ?? `l_${idx}_${Math.random().toString(36).slice(2, 8)}`
                );
                const title = l.title ?? l.name ?? l.heading ?? `Lesson ${idx + 1}`;
                const duration = l.duration ?? l.length ?? l.seconds ?? "";
                const rawVideoUrl = l.videoUrl ?? l.resourceUrl ?? l.url ?? l.src ?? null;
                const videoUrl = rawVideoUrl ? resolveR2Url(rawVideoUrl) : null;

                if (l.lesson && typeof l.lesson === "object") {
                  try {
                    deepParseJsonStrings(l.lesson);
                  } catch {}
                }

                return {
                  id,
                  title,
                  duration,
                  videoUrl,
                  resourceUrl: l.resourceUrl ? resolveR2Url(l.resourceUrl) : null,
                  lesson: l,
                } as Section;
              })
            : []) ?? [];

        sections.forEach((s) => {
          try {
            if (s.lesson && typeof s.lesson === "object") deepParseJsonStrings(s.lesson);
          } catch (e) {}
        });

        if (!cancelled) setCourse({ ...found, sections });

        // hydrate progress
        try {
          const detailsResp = await fetch(`/api/course/${encodeURIComponent(courseId)}/progress`, { credentials: "include" });
          if (detailsResp.ok) {
            const djson = await detailsResp.json();
            if (!cancelled && djson) {
              const detFromAssigned = djson.assignedCourse?.details ?? null;
              const detFromProgress = djson.progress ?? null;
              const det = detFromAssigned ?? detFromProgress ?? djson;
              setWatchedSections(det.watchedSections ?? {});
              setQuizPassed(det.quizPassed ?? {});
              setQuizReports(det.quizReports ?? {});
            }
          }
        } catch (err) {
          console.debug("hydrate progress failed", err);
        }

        // Build timed quizzes map (normalized), with fallback scanner
        const map: Record<string, any[]> = {};
        sections.forEach((s) => {
          let quizzes = extractQuizzesFromLesson(s.lesson) ?? [];

          if ((!quizzes || quizzes.length === 0) && s.lesson) {
            const scanned = findQuizzesByScanning(s.lesson);
            if (scanned && scanned.length) {
              quizzes = scanned;
              console.debug("Quizzes found by scanning for section", s.id, scanned);
            }
          }

          if ((!quizzes || quizzes.length === 0) && s.lesson && typeof s.lesson === "object") {
            const maybe = (s.lesson.content ?? s.lesson.data ?? s.lesson.payload ?? s.lesson.body ?? null);
            if (typeof maybe === "string") {
              try {
                const parsed = JSON.parse(maybe);
                const candidate = extractQuizzesFromLesson(parsed);
                if (candidate && candidate.length) {
                  quizzes = candidate;
                  console.debug("Quizzes found inside parsed content for section", s.id, candidate);
                }
              } catch (e) {}
            } else if (maybe && typeof maybe === "object") {
              const candidate = extractQuizzesFromLesson(maybe);
              if (candidate && candidate.length) {
                quizzes = candidate;
                console.debug("Quizzes found inside content object for section", s.id, candidate);
              }
            }
          }

          const normalized: any[] = [];
          const seenIds = new Set<string>();
          (quizzes ?? []).forEach((q: any, qi: number) => {
            let baseId = String(q?.id ?? q?._id ?? `${s.id}_quiz_${qi}`);
            if (seenIds.has(baseId)) baseId = `${baseId}_${qi}_${Math.random().toString(36).slice(2, 6)}`;
            seenIds.add(baseId);
            const qId = baseId;
            try {
              if (q && typeof q === "object") q.id = qId;
            } catch {}
            if (!q) q = {};
            q.options = normalizeOptions(q.options ?? q.choices ?? q.answers);
            const candidates = [q?.appearAt, q?.time, q?.cueTime, q?.appear_at, q?.start, q?.at, q?.timeSeconds];
            let atSec: number | null = null;
            for (const c of candidates) {
              const parsed = parseTimeToSeconds(c);
              if (parsed != null) {
                atSec = parsed;
                break;
              }
            }
            if (atSec == null && q && typeof q === "object") {
              const maybeMeta = q.meta ?? q.data ?? q.params ?? q.payload ?? q.content ?? null;
              if (maybeMeta && typeof maybeMeta === "object") {
                for (const key of ["appearAt", "time", "cueTime", "when", "appear_at", "start", "at", "timeSeconds"]) {
                  if (maybeMeta[key] != null) {
                    const parsed = parseTimeToSeconds(maybeMeta[key]);
                    if (parsed != null) {
                      atSec = parsed;
                      break;
                    }
                  }
                }
              }
            }
            normalized.push({ __quizId: qId, __sectionId: s.id, appearAt: atSec, quiz: q, originalIndex: qi });
          });
          map[s.id] = normalized.sort((a, b) => (a.appearAt ?? Number.POSITIVE_INFINITY) - (b.appearAt ?? Number.POSITIVE_INFINITY));
        });

        if (!cancelled) {
          setTimedQuizzes(map);
          try {
            (window as any).__timedQuizzesDebug__ = map;
            (window as any).__lastSectionsDebug__ = sections.map((s) => ({ id: s.id, lesson: s.lesson }));
            console.debug("Timed quizzes built:", map);
            console.debug("Last sections:", (window as any).__lastSectionsDebug__);
          } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to initialize course client:", err);
        if (!cancelled) setLoadError(String(err ?? "Failed to load"));
      } finally {
        initialLoadRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  /* ---------- Save progress helper (debounced) ---------- */
  const doSaveProgress = useCallback(
    async (
      maybePayloadOrWatched?: { watchedSections?: Record<string, boolean>; quizPassed?: Record<string, boolean>; quizReports?: Record<string, any>; progress?: number } | Record<string, boolean>,
      maybeQuizPassed?: Record<string, boolean>,
      maybeQuizReports?: Record<string, any>
    ) => {
      try {
        let payload: any = {};
        const first = maybePayloadOrWatched as any;
        const looksLikePayload =
          first &&
          (Object.prototype.hasOwnProperty.call(first, "watchedSections") ||
            Object.prototype.hasOwnProperty.call(first, "quizPassed") ||
            Object.prototype.hasOwnProperty.call(first, "quizReports") ||
            Object.prototype.hasOwnProperty.call(first, "progress"));
        if (looksLikePayload) {
          payload = {
            watchedSections: first.watchedSections ?? {},
            quizPassed: first.quizPassed ?? {},
            quizReports: first.quizReports ?? {},
            progress: typeof first.progress === "number" ? first.progress : undefined,
          };
        } else {
          payload = {
            watchedSections: (maybePayloadOrWatched as Record<string, boolean>) ?? {},
            quizPassed: maybeQuizPassed ?? {},
            quizReports: maybeQuizReports ?? {},
          };
        }

        const ws = payload.watchedSections ?? {};
        const qp = payload.quizPassed ?? {};
        const qr = payload.quizReports ?? {};

        const body: any = {};
        const watchedHasTrue = Object.values(ws || {}).some(Boolean);
        const quizHasTrue = Object.values(qp || {}).some(Boolean);
        if (watchedHasTrue) body.watchedSections = ws;
        if (quizHasTrue) body.quizPassed = qp;
        if (qr && Object.keys(qr).length) body.quizReports = qr;

        const sectionsLen = course?.sections?.length ?? 0;
        const totalQuizzes = Object.values(timedQuizzes).reduce((s, arr) => s + (arr?.length ?? 0), 0);
        const totalItems = 1 + sectionsLen + totalQuizzes;

        const completedSet = new Set<string>();
        Object.entries(ws || {}).forEach(([id, val]) => {
          if (val) completedSet.add(`watched:${id}`);
        });
        Object.entries(qp || {}).forEach(([id, val]) => {
          if (val) completedSet.add(`quiz:${id}`);
        });

        const completedItems = completedSet.size;
        const progress = Math.min((completedItems / Math.max(1, totalItems)) * 100, 100);
        body.progress = Math.max(0, Math.min(100, Math.round(progress)));

        if (!body.progress && !body.watchedSections && !body.quizPassed && !body.quizReports) return;

        await fetch(`/api/course/${encodeURIComponent(courseId)}/progress`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
      } catch (err) {
        console.error("[save] failed saving progress:", err);
      }
    },
    [course, courseId, timedQuizzes]
  );

  const scheduleSaveProgress = useCallback(
    (watched: Record<string, boolean>, quiz: Record<string, boolean>, reports?: Record<string, any>) => {
      pendingSaveRef.current = { watchedSections: watched, quizPassed: quiz, quizReports: reports ?? {} };
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(() => {
        const payload = pendingSaveRef.current!;
        pendingSaveRef.current = null;
        doSaveProgress(payload);
        saveTimeoutRef.current = null;
      }, 800);
    },
    [doSaveProgress]
  );

  useEffect(() => {
    if (initialLoadRef.current) return;
    scheduleSaveProgress(watchedSections, quizPassed, quizReports);
  }, [watchedSections, quizPassed, quizReports, scheduleSaveProgress]);

  /* ---------- Video wiring & timed quiz triggers ---------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const WATCHED_THRESHOLD = 0.85;

    const onLoaded = () => {
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? Math.floor(v.duration) : null;
      setDuration(dur);
      setElapsed(Math.floor(Math.min(v.currentTime || 0, dur ?? Infinity)));
    };

    const onTimeUpdate = () => {
      const cur = Math.floor(v.currentTime || 0);
      setElapsed(cur);

      const sectionId = currentSectionRef.current ?? "intro";
      const sectionQuizzes = timedQuizzes?.[sectionId] ?? [];
      if (sectionQuizzes.length > 0) {
        if (!shownTimedQuizzesRef.current[sectionId]) shownTimedQuizzesRef.current[sectionId] = new Set<string>();
        for (const meta of sectionQuizzes) {
          const appearAt = typeof meta.appearAt === "number" ? Math.floor(meta.appearAt) : null;
          const quizId = meta.__quizId ?? String(meta.quiz?.id ?? `${sectionId}_${meta.originalIndex}`);
          if (appearAt != null && cur >= appearAt && !shownTimedQuizzesRef.current[sectionId].has(quizId)) {
            if (!quizPassed?.[quizId]) {
              shownTimedQuizzesRef.current[sectionId].add(quizId);
              try {
                v.pause();
              } catch {}
              setPlaying(false);
              setActiveQuiz({ meta, quiz: meta.quiz });
              break;
            } else {
              // if already passed, mark shown anyway so it doesn't re-trigger
              shownTimedQuizzesRef.current[sectionId].add(quizId);
            }
          }
        }
      }

      if (Number.isFinite(v.duration) && v.duration > 0) {
        const pct = (v.currentTime || 0) / v.duration;
        if (pct >= WATCHED_THRESHOLD) {
          const sectionId = currentSectionRef.current ?? "intro";
          setWatchedSections((prev) => {
            if (prev?.[sectionId]) return prev;
            const next = { ...(prev ?? {}), [sectionId]: true };
            scheduleSaveProgress(next, quizPassed, quizReports);
            return next;
          });
        }
      }
    };

    const onEnded = () => {
      setPlaying(false);
      const sectionId = currentSectionRef.current ?? "intro";

      // When video ends, evaluate overall quiz percent for this section
      evaluateSectionQuizCompletion(sectionId);

      setWatchedSections((prev) => {
        if (prev?.[sectionId]) return prev;
        // We'll set watchedSections inside evaluateSectionQuizCompletion based on percent,
        // but default behaviour if no quizzes: mark watched.
        const hasAnyQuizzes =
          (timedQuizzes?.[sectionId]?.length ?? 0) + (extractQuizzesFromLesson((course?.sections ?? []).find((s) => s.id === sectionId)?.lesson ?? {})?.length ?? 0) >
          0;
        if (!hasAnyQuizzes) {
          const next = { ...(prev ?? {}), [sectionId]: true };
          scheduleSaveProgress(next, quizPassed, quizReports);
          return next;
        }
        return prev ?? {};
      });
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    v.addEventListener("contextmenu", (e) => e.preventDefault());

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedQuizzes, quizPassed, scheduleSaveProgress, quizReports, course]);

  /* ---------- Play helpers ---------- */
  const chooseInitialVideoSrc = useCallback(() => {
    if (!course) return null;
    if (course.introVideo) return resolveR2Url(course.introVideo);
    const firstWithVideo = course.sections?.find((s) => s.videoUrl || s.resourceUrl);
    return firstWithVideo?.videoUrl ? resolveR2Url(firstWithVideo.videoUrl) : firstWithVideo?.resourceUrl ? resolveR2Url(firstWithVideo.resourceUrl) : null;
  }, [course]);

  const playVideoSrc = useCallback(async (src?: string | null) => {
    const v = videoRef.current;
    if (!v) return;
    if (!src) {
      console.warn("No video src available to play");
      return;
    }
    const resolved = resolveR2Url(src);
    if (v.src !== resolved) {
      v.src = resolved;
      v.load();
    }
    try {
      await v.play();
      setPlaying(true);
    } catch (e) {
      console.error("play failed", e);
    }
  }, []);

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      try {
        await v.play();
        setPlaying(true);
      } catch (e) {
        console.error("play failed", e);
      }
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) await container.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  useEffect(() => {
    if (!course) return;
    const src = chooseInitialVideoSrc();
    const v = videoRef.current;
    if (v && src) {
      const resolved = resolveR2Url(src);
      if (v.src !== resolved) {
        v.src = resolved;
        v.load();
      }
    }
  }, [course, chooseInitialVideoSrc]);

  /* ---------- Utility: compute total quizzes for a section (timed + inline) ---------- */
  const getSectionQuizzesInfo = useCallback(
    (sectionId: string) => {
      const timed = timedQuizzes?.[sectionId] ?? [];
      const sectionObj = (course?.sections ?? []).find((s) => s.id === sectionId);
      const inlineList = extractQuizzesFromLesson(sectionObj?.lesson ?? {}) ?? [];
      // inline quizzes are ones without any timing metadata
      const inlineOnly = (inlineList || []).filter((q: any) => {
        const cands = [q?.appearAt, q?.time, q?.cueTime, q?.appear_at, q?.start, q?.at, q?.timeSeconds];
        for (const c of cands) if (c != null) return false;
        return true;
      });
      return {
        timed: timed,
        inline: inlineOnly,
        totalCount: (timed?.length ?? 0) + (inlineOnly?.length ?? 0),
      };
    },
    [timedQuizzes, course]
  );

  /* ---------- Evaluate and reattempt logic ---------- */

  // Evaluate section quiz completion when video ends OR when last quiz attempted
  const evaluateSectionQuizCompletion = useCallback(
    (sectionId: string) => {
      const { timed, inline, totalCount } = getSectionQuizzesInfo(sectionId);
      if (totalCount === 0) {
        // nothing to evaluate; mark watched
        setWatchedSections((prev) => {
          if (prev?.[sectionId]) return prev;
          const next = { ...(prev ?? {}), [sectionId]: true };
          scheduleSaveProgress(next, quizPassed, quizReports);
          return next;
        });
        return;
      }

      // count passed quizzes in this section
      const allQuizIds: string[] = [];
      timed.forEach((m: any, idx: number) => {
        allQuizIds.push(m.__quizId ?? String(m.quiz?.id ?? `${sectionId}_t_${idx}`));
      });
      inline.forEach((q: any, idx: number) => {
        const qId = q?.id ?? q?._id ?? `${sectionId}_inline_${idx}`;
        allQuizIds.push(qId);
      });

      const passedCount = allQuizIds.reduce((acc, qid) => acc + (quizPassed?.[qid] ? 1 : 0), 0);
      const percent = totalCount ? (passedCount / totalCount) * 100 : 0;

      if (percent >= 80) {
        // mark section watched and save
        setWatchedSections((prev) => {
          const next = { ...(prev ?? {}), [sectionId]: true };
          scheduleSaveProgress(next, quizPassed, quizReports);
          return next;
        });
      } else {
        // less than threshold: we need to reattempt failed quizzes
        // collect failed quiz ids
        const failedIds = allQuizIds.filter((qid) => !quizPassed?.[qid]);
        // ensure they can re-trigger (remove from shownTimedQuizzes set)
        if (!shownTimedQuizzesRef.current[sectionId]) shownTimedQuizzesRef.current[sectionId] = new Set<string>();
        failedIds.forEach((fid) => {
          try {
            shownTimedQuizzesRef.current[sectionId].delete(fid);
          } catch (e) {}
        });

        // if any failed timed quiz exists, seek back to earliest timed failed quiz and resume (it will reappear).
        const failedTimed = (timed || []).filter((m: any) => {
          const qid = m.__quizId ?? String(m.quiz?.id ?? "");
          return failedIds.includes(qid) && typeof m.appearAt === "number";
        });

        const v = videoRef.current;
        if (failedTimed.length > 0 && v) {
          const earliest = failedTimed.reduce((acc: any, cur: any) => {
            if (acc == null) return cur;
            if ((cur.appearAt ?? Infinity) < (acc.appearAt ?? Infinity)) return cur;
            return acc;
          }, null);
          const earliestAt = Math.max(0, Math.floor((earliest?.appearAt ?? 0) - 5));
          try {
            v.currentTime = earliestAt;
          } catch (e) {}
          try {
            v.play().catch(() => {});
            setPlaying(true);
          } catch (e) {}
          return;
        }

        // else if all failed are inline quizzes (no appearAt), open first failed inline quiz modal immediately so user can retake.
        if (failedIds.length > 0 && inline.length > 0) {
          // find first inline failed quiz
          const firstInlineFailed = inline.find((q: any, idx: number) => {
            const qId = q?.id ?? q?._id ?? `${sectionId}_inline_${idx}`;
            return failedIds.includes(qId);
          });
          if (firstInlineFailed) {
            const qIdx = inline.indexOf(firstInlineFailed);
            const qId = firstInlineFailed?.id ?? firstInlineFailed?._id ?? `${sectionId}_inline_${qIdx}`;
            // open modal for this inline quiz
            const meta = { __quizId: qId, __sectionId: sectionId, appearAt: null, quiz: firstInlineFailed };
            try {
              const v2 = videoRef.current;
              if (v2) v2.pause();
            } catch {}
            setPlaying(false);
            setActiveQuiz({ meta, quiz: firstInlineFailed });
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getSectionQuizzesInfo, quizPassed, scheduleSaveProgress, quizReports]
  );

  /* ---------- Quiz evaluation callback (updated behavior) ---------- */
  const evaluateAndFinishQuiz = useCallback(
    (meta: any, quiz: any, answers: Record<string, any>) => {
      const quizId = meta?.__quizId ?? String(quiz?.id ?? `${meta?.__sectionId}_quiz_${meta?.originalIndex}`);
      const sectionId = meta?.__sectionId ?? "intro";
      const details: any[] = [];
      let score = 0;
      let maxScore = 0;

      if (Array.isArray(quiz?.questions) && quiz.questions.length > 0) {
        quiz.questions.forEach((q: any, qi: number) => {
          const qKey = `q_${qi}`;
          const correct = q?.answer ?? q?.correct ?? q?.solution ?? null;
          const opts = normalizeOptions(q?.options ?? q?.choices ?? q?.answers);
          const selected = answers[qKey] ?? null;
          const isCorrect =
            selected != null &&
            (String(selected) === String(correct) || (opts && opts.length && String(selected) === String(getOptionValue(correct, 0))));
          details.push({ question: q?.question ?? q?.prompt ?? `Q${qi + 1}`, selected, correct, isCorrect });
          maxScore += 1;
          if (isCorrect) score += 1;
        });
      } else {
        const correct = quiz?.answer ?? quiz?.correct ?? null;
        const selected = answers["single"] ?? null;
        const isCorrect = selected != null && (String(selected) === String(correct));
        details.push({ question: quiz?.question ?? quiz?.prompt ?? "Question", selected, correct, isCorrect });
        maxScore = 1;
        if (isCorrect) score = 1;
      }

      const percent = maxScore ? (score / maxScore) * 100 : 0;
      const passed = maxScore === 0 ? false : score / maxScore >= 0.8; // 80% pass threshold

      const report = {
        quizId,
        sectionId,
        score,
        maxScore,
        percent: Math.round(percent),
        passed,
        details,
        createdAt: new Date().toISOString(),
      };

      // store report locally
      setQuizReports((prev) => ({ ...(prev ?? {}), [quizId]: report }));

      // mark attempted
      if (!attemptedQuizzesRef.current[sectionId]) attemptedQuizzesRef.current[sectionId] = new Set<string>();
      attemptedQuizzesRef.current[sectionId].add(quizId);

      // manage passed/failed sets
      if (passed) {
        setQuizPassed((prev) => {
          const p = { ...(prev ?? {}), [quizId]: true };
          // persist
          scheduleSaveProgress(watchedSections, p, { ...(quizReports ?? {}), [quizId]: report });
          return p;
        });
        // remove from failed set if present
        if (!failedQuizzesRef.current[sectionId]) failedQuizzesRef.current[sectionId] = new Set<string>();
        failedQuizzesRef.current[sectionId].delete(quizId);
      } else {
        // mark as failed in ref (don't set quizPassed)
        if (!failedQuizzesRef.current[sectionId]) failedQuizzesRef.current[sectionId] = new Set<string>();
        failedQuizzesRef.current[sectionId].add(quizId);
        // ensure quizPassed does not contain it
        setQuizPassed((prev) => {
          const copy = { ...(prev ?? {}) };
          if (Object.prototype.hasOwnProperty.call(copy, quizId)) delete copy[quizId];
          // also persist
          scheduleSaveProgress(watchedSections, copy, { ...(quizReports ?? {}), [quizId]: report });
          return copy;
        });
      }

      // set active quiz result and clear active quiz modal
      setActiveQuizResult(report);
      setActiveQuiz(null);
      setUserAnswers({});

      // After every quiz (pass or fail) try to resume the video automatically
      const v = videoRef.current;
      try {
        if (v) {
          v.play().catch(() => {
            // ignore autoplay errors
          });
          setPlaying(true);
        }
      } catch (e) {
        console.warn("Failed to resume video after quiz attempt", e);
      }

      // After this attempt: check if we've attempted all quizzes in the section -> evaluate overall percent
      const { totalCount, timed, inline } = getSectionQuizzesInfo(sectionId);
      // compute attempted count
      const attemptedSet = attemptedQuizzesRef.current[sectionId] ?? new Set<string>();
      // also account for inline quizzes that may have different ids (ensure matching id rules)
      const allQuizIds: string[] = [];
      timed.forEach((m: any, idx: number) => {
        allQuizIds.push(m.__quizId ?? String(m.quiz?.id ?? `${sectionId}_t_${idx}`));
      });
      inline.forEach((q: any, idx: number) => {
        const qId = q?.id ?? q?._id ?? `${sectionId}_inline_${idx}`;
        allQuizIds.push(qId);
      });

      // if every quiz has been attempted at least once, evaluate
      const allAttempted = allQuizIds.every((qid) => attemptedSet.has(qid));
      if (allAttempted) {
        // compute percent and either mark watched or reattempt failed
        const passedCount = allQuizIds.reduce((acc, qid) => acc + (quizPassed?.[qid] ? 1 : 0), 0);
        const overallPercent = totalCount ? (passedCount / totalCount) * 100 : 0;

        if (overallPercent >= 80) {
          // mark section as watched and persist
          setWatchedSections((prev) => {
            const next = { ...(prev ?? {}), [sectionId]: true };
            scheduleSaveProgress(next, quizPassed, quizReports);
            return next;
          });
        } else {
          // re-attempt failed quizzes
          const failedIds = allQuizIds.filter((qid) => !quizPassed?.[qid]);
          // remove failed timed from shown set so they can re-trigger
          if (!shownTimedQuizzesRef.current[sectionId]) shownTimedQuizzesRef.current[sectionId] = new Set<string>();
          failedIds.forEach((fid) => {
            try {
              shownTimedQuizzesRef.current[sectionId].delete(fid);
            } catch (e) {}
          });

          // if any failed timed quizzes, seek back to earliest failed timed quiz
          const failedTimed = (timed || []).filter((m: any) => {
            const qid = m.__quizId ?? String(m.quiz?.id ?? "");
            return failedIds.includes(qid) && typeof m.appearAt === "number";
          });

          if (failedTimed.length > 0 && v) {
            const earliest = failedTimed.reduce((acc: any, cur: any) => {
              if (acc == null) return cur;
              if ((cur.appearAt ?? Infinity) < (acc.appearAt ?? Infinity)) return cur;
              return acc;
            }, null);
            const earliestAt = Math.max(0, Math.floor((earliest?.appearAt ?? 0) - 5));
            try {
              v.currentTime = earliestAt;
            } catch (e) {}
            try {
              v.play().catch(() => {});
              setPlaying(true);
            } catch (e) {}
            return;
          }

          // else, if only inline failed quizzes remain, open the first failed inline quiz modal
          if (failedIds.length > 0 && inline.length > 0) {
            const firstInlineFailed = inline.find((q: any, idx: number) => {
              const qId = q?.id ?? q?._id ?? `${sectionId}_inline_${idx}`;
              return failedIds.includes(qId);
            });
            if (firstInlineFailed) {
              const qIdx = inline.indexOf(firstInlineFailed);
              const qId = firstInlineFailed?.id ?? firstInlineFailed?._id ?? `${sectionId}_inline_${qIdx}`;
              const meta2 = { __quizId: qId, __sectionId: sectionId, appearAt: null, quiz: firstInlineFailed };
              try {
                if (videoRef.current) videoRef.current.pause();
              } catch (e) {}
              setPlaying(false);
              setActiveQuiz({ meta: meta2, quiz: firstInlineFailed });
            }
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getSectionQuizzesInfo, scheduleSaveProgress, quizReports, watchedSections, quizPassed]
  );

  /* ---------- Render (UI unchanged except requested small layout tweaks) ---------- */
  const progress = (() => {
    const sectionsLen = course?.sections?.length ?? 0;
    const totalQuizzes = Object.values(timedQuizzes).reduce((s, arr) => s + (arr?.length ?? 0), 0);
    const totalItems = 1 + sectionsLen + totalQuizzes;
    const completedSet = new Set<string>();
    Object.entries(watchedSections || {}).forEach(([id, val]) => {
      if (val) completedSet.add(`watched:${id}`);
    });
    Object.entries(quizPassed || {}).forEach(([id, val]) => {
      if (val) completedSet.add(`quiz:${id}`);
    });
    const completedItems = completedSet.size;
    return Math.min(100, totalItems === 0 ? 0 : (completedItems / totalItems) * 100);
  })();

  // Keep fullscreen state in sync with browser fullscreen changes (covers Esc and external changes)
  useEffect(() => {
    const onFsChange = () => {
      const fsEl = document.fullscreenElement;
      if (!fsEl) {
        setIsFullscreen(false);
      } else {
        // if our containerRef is the fullscreen element (or contains it), mark true
        if (containerRef.current && (fsEl === containerRef.current || containerRef.current.contains(fsEl))) {
          setIsFullscreen(true);
        } else {
          setIsFullscreen(false);
        }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopNav />
      <div className="max-w-8xl mx-auto mt-16 px-10">
        {/* Increased horizontal gap between left and right sections (changed gap-8 -> gap-10) */}
        <div className="flex flex-col lg:flex-row gap-7">
          <aside className="w-full lg:w-1/3">
            <div className="bg-gradient-to-b from-indigo-950 via-indigo-800 to-indigo-950 p-5 rounded-2xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">{course?.title ?? "Untitled Course"}</h2>
                <div className="inline-flex items-center gap-2 bg-white/10 text-indigo-100 px-3 py-1 rounded-full text-sm font-medium">
                  {Math.round(progress)}% complete
                </div>
              </div>

              <div className="flex justify-between items-center bg-white/10 rounded-lg p-3 mb-3">
                <div>
                  <div className="text-sm font-semibold text-white">Intro</div>
                  <div className="text-xs text-indigo-200">Overview video</div>
                </div>

                <div className="flex items-center gap-3">
                  {watchedSections["intro"] && (
                    <div className="text-emerald-300 text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">Completed</span>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const src = course?.introVideo ?? (course?.sections?.[0]?.videoUrl ?? null);
                      if (!src) {
                        alert("No intro video available for this course.");
                        return;
                      }
                      currentSectionRef.current = "intro";
                      playVideoSrc(src);
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-white text-sm px-3 py-1.5 rounded-md"
                  >
                    Play
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm text-indigo-100 font-semibold mb-2">Lessons</div>
                {course?.sections?.map((s) => {
                  const done = !!watchedSections[s.id];
                  const lessonReports = Object.values(quizReports).filter((r: any) => r.sectionId === s.id);
                  const score = lessonReports.reduce((acc: any, r: any) => acc + (r.score || 0), 0);
                  const max = lessonReports.reduce((acc: any, r: any) => acc + (r.maxScore || 0), 0);
                  const percent = max > 0 ? Math.round((score / max) * 100) : 0;

                  const inlineQuizzes = (() => {
                    const qlist = extractQuizzesFromLesson(s.lesson) ?? [];
                    return (qlist || []).filter((q: any) => {
                      const cands = [q?.appearAt, q?.time, q?.cueTime, q?.appear_at, q?.start, q?.at, q?.timeSeconds];
                      for (const c of cands) if (c != null) return false;
                      return true;
                    });
                  })();

                  return (
                    <div key={s.id} className="bg-white/10 rounded-lg p-3 mb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{s.title}</div>
                          <div className="text-xs text-indigo-200"> {s.duration ?? "—"}</div>

                          {/* show aggregated marks for this lesson (score / max) */}
                          {max > 0 && (
                            <div className="mt-2 text-xs text-indigo-200">
                              Last attempt: <span className="text-white font-medium">{score}</span> / <span className="text-white">{max}</span> ({percent}%)
                            </div>
                          )}

                          {inlineQuizzes.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs text-indigo-200">Quizzes</div>
                              <ul className="space-y-2 mt-2">
                                {inlineQuizzes.map((q: any, idx: number) => {
                                  const qId = q?.id ?? q?._id ?? `${s.id}_quiz_${idx}`;
                                  const passed = !!quizPassed[qId];
                                  const qTitle = q?.title ?? q?.name ?? (q?.question ?? q?.prompt ?? `Quiz ${idx + 1}`);
                                  return (
                                    <li key={qId} className="flex items-center justify-between gap-3">
                                      <div className="text-xs text-white/90 truncate">
                                        {qTitle} {passed && <span className="ml-2 text-emerald-300">• Passed</span>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            const meta = { __quizId: qId, __sectionId: s.id, appearAt: null, quiz: q };
                                            setActiveQuiz({ meta, quiz: q });
                                          }}
                                          className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                                        >
                                          Take Quiz
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Right column: Play & View buttons on top row, Completed icon moved below the buttons */}
                        <div className="flex flex-col items-end gap-2 ml-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                const srcRaw = s.videoUrl ?? s.resourceUrl ?? null;
                                const src = srcRaw ? resolveR2Url(srcRaw) : null;
                                if (!src) {
                                  alert("No video available for this lesson.");
                                  return;
                                }
                                currentSectionRef.current = s.id;
                                playVideoSrc(src);
                              }}
                              className="bg-amber-500 hover:bg-amber-400 text-white text-sm px-3 py-1.5 rounded-md"
                            >
                              Play
                            </button>

                            <button
                              onClick={() => {
                                const lessonReportsForThis = Object.values(quizReports).filter((r: any) => r.sectionId === s.id);
                                if (lessonReportsForThis.length === 0) {
                                  alert("No quiz attempts recorded for this lesson.");
                                } else {
                                  setReportSectionId(s.id);
                                  setReportModalOpen(true);
                                }
                              }}
                              className="text-xs px-2 py-1 rounded-md text-amber-50 bg-white/10 hover:bg-white/20"
                            >
                              View Quiz Report
                            </button>
                          </div>

                          {done && (
                            <div className="mt-1 text-emerald-300 text-sm flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs">Completed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <main className="w-full lg:w-2/3">
            <div
              ref={containerRef}
              className={`relative rounded-2xl overflow-hidden shadow-xl bg-black aspect-video border-4 border-indigo-950 ${
                isFullscreen ? "!fixed !inset-0 !z-[9999] !rounded-none" : ""
              }`}
            >
              <video
                ref={videoRef}
                className={`${isFullscreen ? "object-contain" : "object-cover"} w-full h-full`}
                playsInline
                preload="metadata"
                onContextMenu={(e) => e.preventDefault()}
                controls={false}
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center px-6 py-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-3">
                  <button onClick={togglePlay} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition" aria-label={playing ? "Pause" : "Play"}>
                    {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                  </button>
                  <span className="text-sm text-white/80">{formatTime(elapsed)} / {formatTime(duration ?? null)}</span>
                </div>
                <button onClick={toggleFullscreen} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
                  {isFullscreen ? <Minimize className="w-5 h-5 text-white" /> : <Maximize className="w-5 h-5 text-white" />}
                </button>
              </div>

              {isFullscreen && activeQuiz && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="pointer-events-auto">
                    <QuizModal
                      activeQuiz={activeQuiz}
                      quizReports={quizReports}
                      onClose={() => {
                        setActiveQuiz(null);
                        setUserAnswers({});
                        setActiveQuizResult(null);
                      }}
                      onSubmit={(meta, quiz, answers) => {
                        evaluateAndFinishQuiz(meta, quiz, answers);
                      }}
                      userAnswers={userAnswers}
                      setUserAnswers={setUserAnswers}
                      activeQuizResult={activeQuizResult}
                      disablePortal={true}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar using red -> green gradient */}
            <div className="mt-6 w-full bg-slate-300 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(to right, #ff4d4f 0%, #ffb199 40%, #a6e56f 80%, #52c41a 100%)",
                }}
              />
            </div>
            <div className="mt-2 text-right text-xs text-slate-600 font-medium">{Math.round(progress)}% Complete</div>
          </main>
        </div>
      </div>

      {!isFullscreen && activeQuiz && (
        <QuizModal
          activeQuiz={activeQuiz}
          quizReports={quizReports}
          onClose={() => {
            setActiveQuiz(null);
            setUserAnswers({});
            setActiveQuizResult(null);
          }}
          onSubmit={(meta, quiz, answers) => {
            evaluateAndFinishQuiz(meta, quiz, answers);
          }}
          userAnswers={userAnswers}
          setUserAnswers={setUserAnswers}
          activeQuizResult={activeQuizResult}
        />
      )}

      {reportModalOpen && (
        <LessonReportModal
          reports={Object.values(quizReports).filter((r: any) => r.sectionId === reportSectionId)}
          onClose={() => {
            setReportModalOpen(false);
            setReportSectionId(null);
          }}
        />
      )}
    </div>
  );
}
