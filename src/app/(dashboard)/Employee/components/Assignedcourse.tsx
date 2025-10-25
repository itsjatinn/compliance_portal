// compliance_portal/src/app/AssignedCoursesGrid.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

/* -------------------- Types -------------------- */
type Course = {
  id: string;
  title?: string;
  description?: string;
  thumbnail?: string | null;
  introVideo?: string | null;
  duration?: string | number | object | null;
  lessons?: number | any[] | null;
  sections?: any[] | null;
  quizzes?: number | any[] | null;
  mandatory?: boolean | string;
  progress?: number;
  [k: string]: any;
};

type Assignment = {
  id: string;
  courseId: string;
  createdAt?: string;
  employeeEmails?: string[];
  employeeIds?: string[];
  course?: Course;
  [k: string]: any;
};

/* -------------------- Constants -------------------- */
const ASSIGN_API = "/api/employee/assigned";
const COURSE_API = "/api/admin/courses";
const COMPLETIONS_API = "/api/completions";
const DEFAULT_THUMBNAIL = "/5994373.jpg"; // put image in /public

/* -------------------- Helpers -------------------- */
const toText = (v: any): string => {
  if (v == null) return "—";
  if (typeof v === "object") {
    if ("title" in v) return String((v as any).title);
    if ("duration" in v) return String((v as any).duration);
    if ("count" in v) return String((v as any).count);
    return String(JSON.stringify(v));
  }
  return String(v);
};

function getStoredProgress(courseId: string) {
  try {
    if (typeof window === "undefined") return { completedItemIds: [] as string[] };
    const raw = localStorage.getItem(`course_progress::${courseId}`);
    if (!raw) return { completedItemIds: [] as string[] };
    return JSON.parse(raw);
  } catch {
    return { completedItemIds: [] as string[] };
  }
}
function setStoredProgress(courseId: string, data: { completedItemIds: string[] }) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(`course_progress::${courseId}`, JSON.stringify(data));
  } catch (e) {
    console.warn("persist progress failed", e);
  }
}

/* Non-skippable video player component */
function NonSkippableVideoPlayer({
  src,
  onEnded,
  uniqueId,
}: {
  src: string;
  onEnded: () => void;
  uniqueId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const ctx = (e: Event) => e.preventDefault();
    v.addEventListener("contextmenu", ctx);

    const onSeeking = () => {
      if (!v) return;
      // prevent seeking by forcing back to last known time
      try {
        if (Math.abs(v.currentTime - lastTimeRef.current) > 0.2) v.currentTime = lastTimeRef.current;
      } catch {}
    };
    const onTimeUpdate = () => {
      if (!v) return;
      lastTimeRef.current = v.currentTime;
    };
    const onEnded = () => {
      try {
        onEnded();
      } catch (e) {}
    };

    v.addEventListener("seeking", onSeeking);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);

    return () => {
      v.removeEventListener("contextmenu", ctx);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
    };
  }, [src, onEnded]);

  const [playing, setPlaying] = useState(false);
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="w-full bg-black">
      <video ref={videoRef} src={src} playsInline className="w-full h-[420px] object-cover bg-black" />
      <div className="p-3 flex items-center gap-3 bg-slate-50 dark:bg-slate-900">
        <button onClick={togglePlay} className="px-4 py-2 bg-indigo-600 text-white rounded-md">
          {playing ? "Pause" : "Play"}
        </button>
        <div className="text-sm text-slate-700 dark:text-slate-300">Seeking disabled — watch to complete</div>
      </div>
    </div>
  );
}

/* Play icon */
const PlayIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="11" stroke="white" strokeOpacity="0.12" strokeWidth="2" />
    <path d="M10 8v8l6-4-6-4z" fill="white" />
  </svg>
);

/* Create a typed fallback course */
function makeFallbackCourse(id: string): Course {
  return {
    id,
    title: id,
    thumbnail: DEFAULT_THUMBNAIL,
    sections: [],
    quizzes: [],
    lessons: 0,
  };
}

/* Utility: convert lessons/quizzes value to numeric count */
function toCount(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (Array.isArray(v)) return v.length;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/* -------------------- Component -------------------- */
export default function AssignedCoursesGrid() {
  const [coursesById, setCoursesById] = useState<Record<string, Course>>({});
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; courseId: string; lessonId?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // progressMap stores percentage (0-100)
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [completedCourses, setCompletedCourses] = useState<string[]>([]);

  /* ---------- Get logged-in user ---------- */
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

  /* ---------- Load courses (cache general course metadata) ---------- */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(COURSE_API, { credentials: "include" });
        if (!r.ok) {
          console.warn("Failed to fetch courses list:", r.status);
          return;
        }
        const j = await r.json();
        const arr: Course[] = Array.isArray(j) ? j : j?.courses || j?.data || [];
        const map: Record<string, Course> = {};
        arr.forEach((c) => {
          if (!c?.id) return;
          const lessonsCount = toCount((c as any).lessons);
          const quizzesCount = toCount((c as any).quizzes);
          map[c.id] = {
            ...c,
            thumbnail: c.thumbnail || (c as any).image || DEFAULT_THUMBNAIL,
            lessons: lessonsCount,
            quizzes: quizzesCount,
          };
        });
        setCoursesById(map);
      } catch (e) {
        console.error("load courses failed", e);
      }
    })();
  }, []);

  /* ---------- Load assignments ---------- */
  useEffect(() => {
    if (!userEmail) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const url = `${ASSIGN_API}?email=${encodeURIComponent(userEmail)}&ts=${Date.now()}`;
        const r = await fetch(url, { signal: controller.signal, credentials: "include" });
        const data = await r.json();
        const arr: Assignment[] = Array.isArray(data) ? data : data.assignments || [];
        setAssignments(arr);

        // merge embedded course info (if API returned it)
        const embeddedMap: Record<string, Course> = {};
        arr.forEach((a: Assignment) => {
          const c = a.course;
          if (c?.id) {
            embeddedMap[c.id] = {
              ...c,
              thumbnail: (c as any).thumbnail || (c as any).image || DEFAULT_THUMBNAIL,
              lessons: toCount((c as any).lessons),
              quizzes: toCount((c as any).quizzes),
            };
          }
        });
        if (Object.keys(embeddedMap).length) {
          setCoursesById((prev) => ({ ...prev, ...embeddedMap }));
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") console.error("assignments load failed", err);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userEmail]);

  /* ---------- Load completions (courses with progress === 100) ---------- */
  useEffect(() => {
    if (!userEmail) return;
    (async () => {
      try {
        const res = await fetch(`${COMPLETIONS_API}?email=${encodeURIComponent(userEmail)}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await res.json();
        let completedIds: string[] = [];
        if (Array.isArray(json)) {
          if (json.length && typeof json[0] === "string") completedIds = json as string[];
          else completedIds = (json as any[]).map((it) => (it?.courseId ? it.courseId : undefined)).filter(Boolean);
        }
        setCompletedCourses(completedIds);
      } catch (e) {
        console.warn("Failed to fetch completions:", e);
      }
    })();
  }, [userEmail]);

  /* ---------- Initialize progressMap: fetch from backend per assigned course (uses userEmail) ---------- */
  useEffect(() => {
    if (!assignments?.length || !userEmail) {
      setProgressMap({});
      return;
    }

    let cancelled = false;
    (async () => {
      const map: Record<string, number> = {};
      await Promise.all(
        assignments.map(async (a) => {
          const courseId = a.courseId;
          const course = coursesById[courseId] ?? makeFallbackCourse(courseId);
          const lessonsCount = toCount(course.lessons);
          const quizzesCount = toCount(course.quizzes);
          const total = Math.max(lessonsCount + quizzesCount, 0);

          try {
            // include email so server can find user-specific progress row
            const res = await fetch(
              `/api/course/${encodeURIComponent(courseId)}/progress?email=${encodeURIComponent(userEmail)}`,
              {
                method: "GET",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
              }
            );

            if (!res.ok) {
              console.warn(`[progress] API returned ${res.status} for course ${courseId} - using localStorage fallback`);
              const s = getStoredProgress(courseId);
              const completedCount = s?.completedItemIds?.length ?? 0;
              map[courseId] = total > 0 ? Math.round((completedCount / total) * 100) : 0;
              return;
            }

            // normalize server response: some endpoints wrap the row under { progress: { ... } }
            const raw = await res.json().catch(() => ({}));
            const payload = raw?.progress ?? raw;

            // debug: uncomment to inspect shape in browser console
            // console.debug("[progress payload]", courseId, payload);

            // prefer explicit numeric progress (0-100)
            if (typeof payload?.progress === "number" && isFinite(payload.progress)) {
              map[courseId] = Math.max(0, Math.min(100, Math.round(payload.progress)));
              return;
            }

            // compute from watchedSections / quizPassed objects
            const watched = payload?.watchedSections ?? payload?.watched ?? {};
            const quiz = payload?.quizPassed ?? payload?.quiz ?? {};
            const watchedCount = Object.values(watched).filter(Boolean).length;
            const quizCount = Object.values(quiz).filter(Boolean).length;
            const completedCount = total > 0 ? Math.min(total, watchedCount + quizCount) : 0;
            map[courseId] = total > 0 ? Math.round((completedCount / total) * 100) : 0;
          } catch (err) {
            console.warn(`[progress] fetching progress failed for ${courseId}`, err);
            const s = getStoredProgress(courseId);
            const completedCount = s?.completedItemIds?.length ?? 0;
            map[courseId] = total > 0 ? Math.round((completedCount / Math.max(total, 1)) * 100) : 0;
          }
        })
      );

      if (!cancelled) setProgressMap((prev) => ({ ...prev, ...map }));
    })();

    return () => {
      cancelled = true;
    };
  }, [assignments, coursesById, userEmail]);

  /* ---------- Mark complete on video end (also persist locally) ---------- */
  function markItemComplete(courseId: string, itemId: string) {
    const s = getStoredProgress(courseId);
    if (!s.completedItemIds.includes(itemId)) {
      s.completedItemIds.push(itemId);
      setStoredProgress(courseId, s);
    }
    const course = coursesById[courseId] ?? makeFallbackCourse(courseId);
    const total = Math.max(toCount(course.lessons) + toCount(course.quizzes), 0);
    const completedCount = s.completedItemIds.length;
    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 100; // if no items, treat as complete
    setProgressMap((prev) => ({ ...prev, [courseId]: pct }));

    // optionally: notify backend about the watched item / update progress via your API
    // fetch(`/api/course/${encodeURIComponent(courseId)}/progress`, { method: 'PUT', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: userEmail, /* watchedSections, progress, etc */ }) }).catch(()=>{});
  }

  function openPreview(courseId: string, lessonId?: string, videoUrl?: string) {
    const url = videoUrl || (coursesById[courseId]?.introVideo ?? DEFAULT_THUMBNAIL);
    setPreview({ url, courseId, lessonId });
  }
  function onPreviewEnded(courseId: string, lessonId?: string) {
    markItemComplete(courseId, lessonId ?? "intro");
    setPreview(null);
  }

  if (loading) return <div className="text-sm text-slate-500">Loading assigned courses…</div>;
  if (!assignments.length) return <div className="text-sm text-slate-500">No assigned courses found.</div>;

  /* ---------- UI ---------- */
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map((assignment) => {
          const course = coursesById[assignment.courseId] ?? makeFallbackCourse(assignment.courseId);
          const lessonsCount = toCount(course.lessons);
          const quizzesCount = toCount(course.quizzes);
          const total = Math.max(lessonsCount + quizzesCount, 0);

          // progressPercent is overall progress (0-100) pulled from backend if available
          const progressPercent = completedCourses.includes(course.id)
            ? 100
            : Math.max(0, Math.min(100, progressMap[course.id] ?? Math.round((course.progress ?? 0) || 0)));

          // compute completed items for display: prefer localStorage then percent -> count
          const stored = getStoredProgress(course.id);
          let completedItems: number | null = null;
          if (stored?.completedItemIds?.length > 0) {
            completedItems = stored.completedItemIds.length;
          } else if (total > 0) {
            completedItems = Math.round((progressPercent / 100) * total);
          } else {
            completedItems = null; // unknown — don't show "0 / 1"
          }

          const isMandatory = String(course.mandatory ?? "").toLowerCase() === "mandatory";

          return (
            <div
              key={assignment.id}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="relative">
                <img
                  src={course.thumbnail || DEFAULT_THUMBNAIL}
                  alt={toText(course.title)}
                  className="w-full h-44 object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <button
                  onClick={() => openPreview(course.id, undefined, course.introVideo || undefined)}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <PlayIcon className="w-7 h-7 text-white" />
                  </div>
                </button>
              </div>

              <div className="p-5">
                <h3 className="text-lg font-semibold mb-1 truncate">{toText(course.title)}</h3>
                <div className="text-xs text-slate-400 mb-4">
                  Assigned: {new Date(assignment.createdAt || Date.now()).toLocaleDateString()}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span>
                    <span>{progressPercent}%</span>
                  </div>

                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${progressPercent}%`,
                        background: `linear-gradient(90deg, rgba(239,68,68,1) 0%, rgba(250,204,21,1) 50%, rgba(16,185,129,1) 100%)`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href={`/courses/${course.id}`}
                    className="flex-1 text-center px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
                  >
                    {progressPercent >= 100 ? "Completed ✓" : "Continue"}
                  </a>
                  <button
                    onClick={() => openPreview(course.id, undefined, course.introVideo || undefined)}
                    className="px-3 py-2 text-sm border rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    Preview
                  </button>
                </div>

                
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl w-[92%] max-w-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b">
              <div className="text-sm font-medium">Preview</div>
              <button onClick={() => setPreview(null)} className="text-xl px-2">
                ✕
              </button>
            </div>

            <NonSkippableVideoPlayer
              src={preview.url}
              uniqueId={`${preview.courseId}::${preview.lessonId ?? "intro"}`}
              onEnded={() => onPreviewEnded(preview.courseId, preview.lessonId)}
            />
          </div>
        </div>
      )}
    </>
  );
}
