// src/app/(dashboard)/admin/components/CoursesManager.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, Plus, UploadCloud, Video, PlusCircle, Edit2, Trash2 } from "lucide-react";

/* ---------------- Types ---------------- */
type QuizQuestion = {
  id?: string;
  question: string;
  options?: string[];
  answer?: string | null;
  appearAt?: number | null;
};

type DraftLesson = {
  id: string;
  title: string;
  duration?: string | number | null;
  summary?: string | null;
  content?: string | null;
  resourceFile?: File | null; // upload new files
  quizPreview?: string | null; // JSON string: { quizzes: QuizQuestion[] }
  resourceFileName?: string | null;
  __parsedQuizzes?: QuizQuestion[] | null;
  resourceUrl?: string | null; // existing server url if editing
};

type DraftCourse = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  duration?: string | number | null;
  thumbnail?: File | null;
  introVideo?: File | null;
  lessons: DraftLesson[];
  updatedAt?: string;
};

type CourseMeta = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  uploadedAt?: string;
  updatedAt?: string;
  intro?: string | null; // thumbnail url / image
  introVideo?: string | null; // intro video url
  image?: string | null;
  thumbnail?: string | null;
  sections?: any;
  lessons?: any;
  courseLessons?: any;
  [k: string]: any;
};



function uid(prefix = "c") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ---------------- Utilities ---------------- */
function isValidUrlString(s: any) {
  return typeof s === "string" && s.trim() !== "" && s !== "null";
}

function parseDurationToSeconds(input?: string | number | null): number | null {
  if (input === undefined || input === null) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.max(0, Math.floor(input));
  }
  const s = String(input).trim();
  if (!s) return null;

  if (/^\d+:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return parts[0] * 60 + parts[1];
  }

  const regex = /(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:ec(?:ond)?s?)?)?/i;
  const match = s.match(regex);
  if (match && (match[1] || match[2] || match[3])) {
    const hours = match[1] ? parseFloat(match[1]) : 0;
    const mins = match[2] ? parseFloat(match[2]) : 0;
    const secs = match[3] ? parseFloat(match[3]) : 0;
    return Math.round(hours * 3600 + mins * 60 + secs);
  }

  const numUnit = s.match(/^(\d+(?:\.\d+)?)([hms])$/i);
  if (numUnit) {
    const val = parseFloat(numUnit[1]);
    const unit = numUnit[2].toLowerCase();
    if (unit === "h") return Math.round(val * 3600);
    if (unit === "m") return Math.round(val * 60);
    if (unit === "s") return Math.round(val);
  }

  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));

  return null;
}

function safeTryParse(txt: string | null) {
  if (!txt) return null;
  try {
    const p = JSON.parse(txt);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray((p as any).quizzes)) return (p as any).quizzes;
    return null;
  } catch {
    return null;
  }
}

function safeParseQuizzes(raw: string | null): QuizQuestion[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as QuizQuestion[];
    if (parsed && Array.isArray((parsed as any).quizzes)) return (parsed as any).quizzes as QuizQuestion[];
    return null;
  } catch {
    return null;
  }
}

/** Normalize quiz options that might be stored as ["A;B;C"] to ["A","B","C"] */
function normalizeQuiz(q: any): QuizQuestion {
  const out: QuizQuestion = {
    id: q.id,
    question: q.question ?? "",
    options: undefined,
    answer: q.answer ?? null,
    appearAt: q.appearAt != null ? Number(q.appearAt) : null,
  };

  if (Array.isArray(q.options)) {
    if (q.options.length === 1 && typeof q.options[0] === "string" && q.options[0].includes(";")) {
      out.options = q.options[0].split(";").map((s: string) => s.trim()).filter(Boolean);
    } else {
      out.options = q.options.map((o: any) => (typeof o === "string" ? o.trim() : String(o)));
    }
  } else if (typeof q.options === "string") {
    out.options = q.options.split(";").map((s: string) => s.trim()).filter(Boolean);
  }

  return out;
}

function assignAppearTimes(quizzes: QuizQuestion[], lessonDurationSeconds: number | null): QuizQuestion[] {
  const out = quizzes.map((q) => ({ ...q }));
  const missing = out.filter((q) => q.appearAt == null).length;
  if (missing === 0) return out;

  if (lessonDurationSeconds && lessonDurationSeconds > 5) {
    const start = Math.max(3, Math.round(lessonDurationSeconds * 0.05));
    const end = Math.max(start + 1, Math.round(lessonDurationSeconds * 0.9));
    const slots = missing === 1 ? [Math.round((start + end) / 2)] : Array.from({ length: missing }, (_, i) => Math.round(start + ((end - start) * i) / Math.max(1, missing - 1)));
    let sidx = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i].appearAt == null) out[i].appearAt = slots[sidx++] ?? start;
    }
  } else {
    let t = 5;
    for (let i = 0; i < out.length; i++) {
      if (out[i].appearAt == null) {
        out[i].appearAt = t;
        t += 10;
      }
    }
  }
  return out;
}

/* ---------------- Normalizer helpers ---------------- */
function tryParseContentRawForQuizzes(contentRaw: any): QuizQuestion[] | null {
  if (!contentRaw) return null;
  if (typeof contentRaw === "object") {
    if (Array.isArray((contentRaw as any).quizzes)) {
      return (contentRaw as any).quizzes.map(normalizeQuiz);
    }
    return null;
  }
  if (typeof contentRaw === "string") {
    const trimmed = contentRaw.trim();
    const parsed = safeTryParse(trimmed);
    if (parsed && Array.isArray(parsed)) {
      return parsed.map(normalizeQuiz);
    }
    try {
      const double = JSON.parse(trimmed);
      const p2 = safeTryParse(typeof double === "string" ? double : double);
      if (p2 && Array.isArray(p2)) return p2.map(normalizeQuiz);
    } catch {
      // ignore
    }
  }
  return null;
}

/* ---------------- normalizeLessonForEditor ---------------- */
function normalizeLessonForEditor(secOrLesson: any): DraftLesson {
  const lesson = secOrLesson?.lesson ?? secOrLesson;

  const resourceUrl =
    lesson?.resourceUrl ??
    lesson?.videoUrl ??
    secOrLesson?.resourceUrl ??
    secOrLesson?.videoUrl ??
    null;

  let parsedQuizzes: QuizQuestion[] | null = null;

  if (Array.isArray(lesson?.quizzes) && lesson.quizzes.length) {
    parsedQuizzes = lesson.quizzes.map(normalizeQuiz);
  } else if (typeof lesson?.content === "string" && lesson.content.includes('"quizzes"')) {
    parsedQuizzes = tryParseContentRawForQuizzes(lesson.content);
  } else if (typeof lesson?.contentRaw === "string" && lesson.contentRaw.includes('"quizzes"')) {
    parsedQuizzes = tryParseContentRawForQuizzes(lesson.contentRaw);
  } else if (Array.isArray(secOrLesson?.quizzes) && secOrLesson.quizzes.length) {
    parsedQuizzes = secOrLesson.quizzes.map(normalizeQuiz);
  } else if (typeof secOrLesson?.content === "string" && secOrLesson.content.includes('"quizzes"')) {
    parsedQuizzes = tryParseContentRawForQuizzes(secOrLesson.content);
  } else if (typeof secOrLesson?.contentRaw === "string" && secOrLesson.contentRaw.includes('"quizzes"')) {
    parsedQuizzes = tryParseContentRawForQuizzes(secOrLesson.contentRaw);
  }

  const quizPreviewText = parsedQuizzes && parsedQuizzes.length ? JSON.stringify({ quizzes: parsedQuizzes }, null, 2) : null;

  let contentText: string | null = null;
  if (typeof lesson?.content === "string") {
    const maybeQuizzes = tryParseContentRawForQuizzes(lesson.content);
    if (!maybeQuizzes) contentText = lesson.content;
  } else if (typeof lesson?.contentRaw === "string") {
    const maybeQuizzes = tryParseContentRawForQuizzes(lesson.contentRaw);
    if (!maybeQuizzes) contentText = lesson.contentRaw;
  } else if (typeof secOrLesson?.content === "string") {
    const maybeQuizzes = tryParseContentRawForQuizzes(secOrLesson.content);
    if (!maybeQuizzes) contentText = secOrLesson.content;
  }

  const lessonId = lesson?.id ?? secOrLesson?.id ?? uid("l");
  const title = lesson?.title ?? secOrLesson?.title ?? "";
  const duration = lesson?.duration ?? secOrLesson?.duration ?? "";
  const summary = lesson?.summary ?? secOrLesson?.summary ?? "";

  return {
    id: lessonId,
    title: title ?? "",
    duration: duration ?? "",
    summary: summary ?? "",
    content: contentText ?? "",
    resourceFile: null,
    resourceFileName: resourceUrl ? String(resourceUrl).split("/").pop() : null,
    resourceUrl: resourceUrl ?? null,
    quizPreview: quizPreviewText,
    __parsedQuizzes: parsedQuizzes,
  };
}

/* ---------------- NEW: default thumbnail key and R2 resolver ---------------- */

/**
 * Your default thumbnail key on R2 (used when creating courses and no thumbnail uploaded)
 */
const DEFAULT_THUMBNAIL_KEY = "thumbnails/5994373.jpg";

/**
 * Convert a key (e.g. "thumbnails/5994373.jpg") or absolute URL into a browser-usable URL.
 * Requires NEXT_PUBLIC_R2_PUBLIC_URL to be set in env (e.g. https://pub-xxxxx.r2.dev)
 * If the input is already an absolute URL, returns it unchanged.
 */
function resolveMediaUrl(keyOrUrl?: string | null): string | null {
  if (!keyOrUrl) return null;
  const s = String(keyOrUrl).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:|^blob:/i.test(s)) return s;

  const base = typeof process !== "undefined" && (process as any).env && (process as any).env.NEXT_PUBLIC_R2_PUBLIC_URL
    ? (process as any).env.NEXT_PUBLIC_R2_PUBLIC_URL
    : (typeof window !== "undefined" && (window as any).__NEXT_DATA__ && (window as any).__NEXT_DATA__.env && (window as any).__NEXT_DATA__.env.NEXT_PUBLIC_R2_PUBLIC_URL)
    ? (window as any).__NEXT_DATA__.env.NEXT_PUBLIC_R2_PUBLIC_URL
    : "https://pub-xxxxxxxxxx.r2.dev";

  const key = s.replace(/^\/+/, "");
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(key)}`;
}

/* ---------------- Component ---------------- */
export default function CoursesManager({ apiBase = "/api/admin" }: { apiBase?: string }) {
  const [course, setCourse] = useState<DraftCourse>(() => ({
    id: uid("draft"),
    title: "",
    subtitle: "",
    description: "",
    duration: "",
    thumbnail: null,
    introVideo: null,
    lessons: [],
  }));

  const [message, setMessage] = useState<{ text: string; type: "error" | "success" | "info" } | null>(null);
  const [saving, setSaving] = useState(false);

  const [courses, setCourses] = useState<CourseMeta[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // initialize preview to resolved default thumbnail URL
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? "");
  const [introVideoPreview, setIntroVideoPreview] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMetaId, setEditingMetaId] = useState<string | null>(null);
  const [loadingEditor, setLoadingEditor] = useState(false);

  /* ---------------- Fetch / Refresh ---------------- */
  const refreshCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const res = await fetch(`${apiBase}/courses`);
      if (!res.ok) throw new Error(`Fetch courses failed (${res.status})`);
      const json = await res.json();
      setCourses(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("refreshCourses failed", err);
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, [apiBase]);

  useEffect(() => {
    refreshCourses();
  }, [refreshCourses]);

  /* ---------------- Helpers ---------------- */
  const updateCourse = useCallback((patch: Partial<DraftCourse>) => {
    setCourse((c) => ({ ...c, ...patch }));
  }, []);

  const addLesson = useCallback(() => {
    setCourse((c) => ({
      ...c,
      lessons: [
        ...c.lessons,
        {
          id: uid("l"),
          title: "",
          duration: "",
          summary: "",
          content: "",
          resourceFile: null,
          quizPreview: null,
          resourceFileName: null,
          __parsedQuizzes: null,
          resourceUrl: null,
        },
      ],
    }));
  }, []);

  const updateLesson = useCallback((id: string, patch: Partial<DraftLesson>) => {
    setCourse((c) => ({ ...c, lessons: c.lessons.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }, []);

  const removeLesson = useCallback((id: string) => {
    setCourse((c) => ({ ...c, lessons: c.lessons.filter((l) => l.id !== id) }));
  }, []);

  // track object URLs to revoke on change/unmount
  const thumbnailObjectUrlRef = React.useRef<string | null>(null);
  const introVideoObjectUrlRef = React.useRef<string | null>(null);

  const setThumbnail = useCallback((f: File | null) => {
    setCourse((c) => ({ ...c, thumbnail: f }));
    if (thumbnailObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(thumbnailObjectUrlRef.current);
      } catch {
        // ignore
      }
      thumbnailObjectUrlRef.current = null;
    }

    if (!f) {
      setThumbnailPreview(resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? "");
      return;
    }
    const url = URL.createObjectURL(f);
    thumbnailObjectUrlRef.current = url;
    setThumbnailPreview(url);
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (thumbnailObjectUrlRef.current) try { URL.revokeObjectURL(thumbnailObjectUrlRef.current); } catch {}
      if (introVideoObjectUrlRef.current) try { URL.revokeObjectURL(introVideoObjectUrlRef.current); } catch {}
    };
  }, []);

  const setIntroVideo = useCallback((f: File | null) => {
    setCourse((c) => ({ ...c, introVideo: f }));
    if (introVideoObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(introVideoObjectUrlRef.current);
      } catch {
        // ignore
      }
      introVideoObjectUrlRef.current = null;
    }

    if (!f) {
      setIntroVideoPreview(null);
      return;
    }
    const url = URL.createObjectURL(f);
    introVideoObjectUrlRef.current = url;
    setIntroVideoPreview(url);
  }, []);

  /* ---------------- Upload Helper (PRESIGN + direct PUT to R2) ---------------- */
 const uploadFile = useCallback(
  async (file: File | null | undefined, timeoutMs = 10 * 60 * 1000, folder = "videos"): Promise<string | null> => {
    if (!file) return null;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder); // optional; server validates allowedFolders

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`/api/admin/uploads/proxy`, {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(to);

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Upload failed (${res.status})`);
      }

      const json = await res.json().catch(() => null);
      if (!json || !json.ok || !json.key) {
        throw new Error(`Invalid upload response: ${JSON.stringify(json)}`);
      }
      return String(json.key);
    } catch (err: any) {
      clearTimeout(to);
      if (err?.name === "AbortError") throw new Error("Upload timed out");
      throw err;
    }
  },
  []
);



  /* ---------------- Save Course ---------------- */
  const saveCourse = useCallback(async () => {
    if (!course.title.trim()) {
      setMessage({ text: "Course title is required.", type: "error" });
      return;
    }
    if (!course.introVideo && !introVideoPreview) {
      setMessage({ text: "Introduction video is required.", type: "error" });
      return;
    }
    if (course.lessons.length === 0) {
      setMessage({ text: "Add at least one lesson before saving.", type: "error" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // For images/thumbnails, use folder "thumbnails" or "images" depending on your R2 setup
      // If user didn't upload, use DEFAULT_THUMBNAIL_KEY (R2 key)
      const imageUrlOrKey = course.thumbnail
        ? await uploadFile(course.thumbnail, 10 * 60 * 1000, "thumbnails")
        : DEFAULT_THUMBNAIL_KEY;

      const introVideoUrlOrKey = course.introVideo ? await uploadFile(course.introVideo, 10 * 60 * 1000, "videos") : (isValidUrlString(introVideoPreview) ? introVideoPreview : null);

      const lessonsPayload: any[] = [];

      for (const l of course.lessons) {
        try {
          const resourceUrlOrKey = l.resourceFile ? await uploadFile(l.resourceFile, 10 * 60 * 1000, "videos") : l.resourceUrl ?? null;
          const lessonDurationSeconds = parseDurationToSeconds(l.duration);

          const parsedPreview: QuizQuestion[] | null = l.__parsedQuizzes ?? (l.quizPreview ? safeParseQuizzes(l.quizPreview) : null);

          let contentToSend: string | null = l.content ?? null;

          if (parsedPreview && parsedPreview.length > 0) {
            const assigned = assignAppearTimes(parsedPreview, lessonDurationSeconds);
            try {
              contentToSend = JSON.stringify({ quizzes: assigned });
            } catch {
              contentToSend = l.content ?? null;
            }
          } else if (l.quizPreview && !parsedPreview) {
            contentToSend = l.content ?? l.quizPreview;
          }

          lessonsPayload.push({
            id: l.id,
            title: l.title || null,
            duration: lessonDurationSeconds,
            summary: l.summary ?? null,
            content: contentToSend ?? null,
            resourceUrl: resourceUrlOrKey ?? null,
          });
        } catch (lessonErr: any) {
          console.error("lesson upload failed for", l.id, lessonErr);
          lessonsPayload.push({
            id: l.id,
            title: l.title || null,
            duration: parseDurationToSeconds(l.duration),
            summary: l.summary ?? null,
            content: l.content ?? null,
            resourceUrl: l.resourceUrl ?? null,
          });
        }
      }

      const courseDurationSeconds = parseDurationToSeconds(course.duration);

      const payload = {
        title: course.title.trim(),
        subtitle: course.subtitle ?? null,
        description: course.description ?? null,
        duration: courseDurationSeconds,
        image: imageUrlOrKey ?? null,
        introVideo: introVideoUrlOrKey ?? null,
        lessons: lessonsPayload,
      };

      const url = editingMetaId ? `${apiBase}/courses/${encodeURIComponent(editingMetaId)}` : `${apiBase}/courses`;
      // keep existing behavior: use PUT for editing, POST for creating
      let method = editingMetaId ? "PUT" : "POST";

      const attemptFetch = async (m: string) => {
        const res = await fetch(url, {
          method: m,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const ct = res.headers.get("content-type") || "";
        const body = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);
        return { res, ct, body };
      };

      let response = await attemptFetch(method);

      // If server returns 405 for PUT, try PATCH as a fallback (minimal change, keeps logic intact)
      if (response.res.status === 405 && editingMetaId && method === "PUT") {
        console.warn("[CoursesManager] PUT returned 405, retrying with PATCH");
        method = "PATCH";
        response = await attemptFetch(method);
      }

      const { res, ct, body } = response;

      if (!res.ok) {
        console.error("save failed:", { status: res.status, statusText: res.statusText, contentType: ct, body });
        let errMsg = `Save failed (status ${res.status})`;
        if (body && typeof body === "object" && (body as any).error) errMsg = String((body as any).error);
        else if (typeof body === "string" && body.trim()) errMsg = body;
        setMessage({ text: errMsg, type: "error" });
        return;
      }

      setMessage({ text: `Course ${editingMetaId ? "updated" : "saved"} successfully.`, type: "success" });
      setEditorOpen(false);
      setEditingMetaId(null);
      setIntroVideoPreview(null);

      setCourse({
        id: uid("draft"),
        title: "",
        subtitle: "",
        description: "",
        duration: "",
        thumbnail: null,
        introVideo: null,
        lessons: [],
      });
      await refreshCourses();
    } catch (e: any) {
      console.error("Save failed:", e);
      setMessage({ text: e?.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }, [course, uploadFile, refreshCourses, apiBase, editingMetaId, introVideoPreview, thumbnailPreview]);

  /* ---------------- Delete Course ---------------- */
  const removeCourse = useCallback(
    async (id: string) => {
      if (!confirm("Delete this course and its files?")) return;
      try {
        const res = await fetch(`${apiBase}/courses/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          const ct = res.headers.get("content-type") || "";
          const body = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);
          throw new Error((body && (body as any).error) || `Delete failed (status ${res.status})`);
        }
        await refreshCourses();
        setMessage({ text: "Removed successfully", type: "success" });
      } catch (err: any) {
        console.error("Remove failed:", err);
        setMessage({ text: err?.message || "Remove failed", type: "error" });
      }
    },
    [apiBase, refreshCourses]
  );

  /* ---------------- UPDATED editCourse ---------------- */
  const editCourse = useCallback(
    async (id: string) => {
      setLoadingEditor(true);
      setMessage(null);

      try {
        const res = await fetch(`${apiBase}/courses/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`Failed to fetch course (${res.status})`);
        const json = await res.json();

        // Debug to inspect API shape if needed
        console.debug("[CoursesManager] raw course response:", json);

        let meta: any = json;
        if (meta && typeof meta === "object") {
          if (meta.data && typeof meta.data === "object") meta = meta.data;
          if (meta.course && typeof meta.course === "object") meta = meta.course;
          if (Array.isArray(meta) && meta.length === 1 && typeof meta[0] === "object") meta = meta[0];
        }

        // Prefer courseLessons array (your backend)
        const lessonsArray =
          Array.isArray(meta.courseLessons) && meta.courseLessons.length
            ? meta.courseLessons
            : Array.isArray(meta.lessons) && meta.lessons.length
            ? meta.lessons
            : Array.isArray(meta.sections) && meta.sections.length
            ? meta.sections
            : [];

        // normalize lessons and resolve resource URLs from keys or urls
        const mappedLessons: DraftLesson[] = lessonsArray.map((lesson: any) => {
          const normalized = normalizeLessonForEditor(lesson);
          // resolve resourceUrl (if it's a key, convert to public url)
          if (normalized.resourceUrl) normalized.resourceUrl = resolveMediaUrl(normalized.resourceUrl);
          return normalized;
        });

        // As a last fallback, if nothing found, try treating meta itself as lesson-like
        if (mappedLessons.length === 0) {
          const fallback = normalizeLessonForEditor(meta);
          if (fallback && (fallback.title || fallback.__parsedQuizzes || fallback.resourceUrl || fallback.content)) {
            if (fallback.resourceUrl) fallback.resourceUrl = resolveMediaUrl(fallback.resourceUrl);
            mappedLessons.push(fallback);
          }
        }

        console.debug("[CoursesManager] normalized lessons:", mappedLessons);

        setCourse({
          id: meta.id ?? uid("draft"),
          title: meta.title ?? "",
          subtitle: meta.subtitle ?? null,
          description: meta.description ?? null,
          duration: meta.duration ?? "",
          thumbnail: null,
          introVideo: null,
          lessons: mappedLessons,
          updatedAt: meta.updatedAt ?? meta.createdAt ?? undefined,
        });

        // determine the thumbnail and intro values the server returned (may be keys or full urls)
        const thumbFromServer =
          isValidUrlString(meta.image) && meta.image
            ? meta.image
            : isValidUrlString(meta.thumbnail) && meta.thumbnail
            ? meta.thumbnail
            : isValidUrlString(meta.intro) && meta.intro
            ? meta.intro
            : DEFAULT_THUMBNAIL_KEY;

        const introFromServer =
          isValidUrlString(meta.introVideo) && meta.introVideo
            ? meta.introVideo
            : isValidUrlString(meta.introVideoUrl) && meta.introVideoUrl
            ? meta.introVideoUrl
            : meta.intro ?? null;

        // resolve to public URLs for preview
        setThumbnailPreview(resolveMediaUrl(thumbFromServer) ?? resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? "");
        setIntroVideoPreview(resolveMediaUrl(introFromServer) ?? null);

        setEditingMetaId(meta.id ?? null);
        setEditorOpen(true);
        setMessage({ text: `Loaded "${meta.title ?? meta.name ?? "course"}" into the editor.`, type: "info" });

        console.debug("[CoursesManager] final draft.course:", {
          id: meta.id,
          title: meta.title ?? meta.name,
          lessonCount: mappedLessons.length,
          firstLesson: mappedLessons[0] ?? null,
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err: any) {
        console.error("Failed to load course for editing:", err);
        setMessage({ text: err?.message || "Failed to load course", type: "error" });
      } finally {
        setLoadingEditor(false);
      }
    },
    [apiBase]
  );

  const coursesToDisplay = useMemo(() => courses, [courses]);

  /* ---------------- Render ---------------- */
  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <BookOpen className="text-indigo-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Courses</h1>
            <p className="text-sm text-slate-500">Recent uploads appear below. Click Upload to add a new course.</p>
          </div>
        </div>

        <div>
          <button
            onClick={() => {
              setCourse({
                id: uid("draft"),
                title: "",
                subtitle: "",
                description: "",
                duration: "",
                thumbnail: null,
                introVideo: null,
                lessons: [],
              });
              setEditingMetaId(null);
          
              setIntroVideoPreview(null);
              // set preview to default resolved thumbnail
              setThumbnailPreview(resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? "");
              setEditorOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md"
          >
            <PlusCircle size={16} /> Upload Course
          </button>
        </div>
      </div>

      {/* MESSAGE */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className={`text-sm p-3 rounded-lg flex justify-between items-center ${
            message.type === "error"
              ? "bg-red-50 text-red-800"
              : message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-blue-50 text-blue-800"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="font-medium truncate">{message.text}</div>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 rounded-full hover:bg-white/50">
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* RECENT COURSES - card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingCourses && <div className="text-sm text-slate-500">Loading courses...</div>}
        {!loadingCourses && coursesToDisplay.length === 0 && <div className="text-sm text-slate-400">No recent courses found.</div>}

        {coursesToDisplay.map((c) => {
          const rawThumb =
            isValidUrlString(c.image) ? c.image :
            isValidUrlString(c.thumbnail) ? c.thumbnail :
            isValidUrlString(c.intro) ? c.intro :
            isValidUrlString(c.introVideo) ? c.introVideo :
            DEFAULT_THUMBNAIL_KEY;

          const thumb = resolveMediaUrl(rawThumb) ?? resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? DEFAULT_THUMBNAIL_KEY;

          return (
            <div key={c.id} className="bg-white rounded-2xl shadow-md overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-40 w-full overflow-hidden bg-pink-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb ?? (resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? "")}
                  alt={c.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const t = e.currentTarget;
                    const fallback = resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? "";
                    if (t.src !== fallback) t.src = fallback;
                  }}
                />
              </div>

              <div className="p-4">
                <h3 className="text-lg font-semibold text-slate-800 truncate">{c.title}</h3>
                <div className="text-xs text-slate-500 mt-1 truncate">{c.subtitle ?? c.description ?? "—"}</div>
                <div className="text-xs text-slate-400 mt-2">
                  {c.updatedAt ? `Updated: ${new Date(c.updatedAt).toLocaleString()}` : c.uploadedAt ? `Uploaded: ${new Date(c.uploadedAt).toLocaleString()}` : ""}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button
                      title="Edit"
                      onClick={() => editCourse(c.id)}
                      className="px-3 py-2 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 inline-flex items-center gap-2"
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button title="Delete" onClick={() => removeCourse(c.id)} className="px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-100 inline-flex items-center gap-2">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor modal (styled modern, light theme) */}
      <AnimatePresence>
        {editorOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 flex items-start sm:items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => { setEditorOpen(false); setEditingMetaId(null); }} />

            <motion.div
              layout
              initial={{ y: 18, scale: 0.99 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 12, scale: 0.99 }}
              className="relative z-50 w-full max-w-6xl bg-slate-50 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <BookOpen className="text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{editingMetaId ? (loadingEditor ? "Loading..." : "Edit Course") : "Upload Course"}</h2>
                    <div className="text-sm text-slate-500">Fill fields and Save to publish.</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => { setEditorOpen(false); setEditingMetaId(null); }} className="px-4 py-2 rounded-lg border text-slate-700">Close</button>
                  <button onClick={saveCourse} disabled={saving || !course.title.trim() || (!course.introVideo && !introVideoPreview)} className="px-5 py-2 rounded-2xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md disabled:opacity-60">
                    {saving ? "Saving..." : editingMetaId ? "Save Changes" : "Upload & Publish"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: main editor area (spacious) */}
                <div className="lg:col-span-2 space-y-6">
                  <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="mb-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Course details</label>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs text-slate-500">Course title</label>
                        <input value={course.title} onChange={(e) => updateCourse({ title: e.target.value })} placeholder="Course title" className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-500">Duration (optional)</label>
                          <input value={course.duration ?? ""} onChange={(e) => updateCourse({ duration: e.target.value })} placeholder="e.g. 2h 15m" className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm" />
                        </div>
                        <div />
                      </div>
                    </div>
                  </section>

                  <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Lessons</h3>
                      <button onClick={addLesson} className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-sm">
                        <Plus size={14} /> Add Lesson
                      </button>
                    </div>

                    <div className="space-y-4">
                      {course.lessons.length === 0 && <div className="text-sm text-slate-400">No lessons yet — add one.</div>}

                      {course.lessons.map((lesson, li) => (
                        <LessonEditor key={lesson.id} lesson={lesson} index={li} updateLesson={(p) => updateLesson(lesson.id, p)} removeLesson={() => removeLesson(lesson.id)} />
                      ))}
                    </div>
                  </section>
                </div>

                {/* Right: media + metadata */}
                <aside className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">Course Thumbnail</div>
                        <div className="text-xs text-slate-400">Recommended: 1280x720</div>
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-dashed border-gray-100 bg-white">
                      <div className="w-full h-36 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumbnailPreview ?? (resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? "")} alt="Course Thumbnail Preview" className="w-full h-full object-cover" onError={(e) => { const t = e.currentTarget; const fallback = resolveMediaUrl(DEFAULT_THUMBNAIL_KEY) ?? ""; if (t.src !== fallback) t.src = fallback; }} />
                      </div>

                      <div className="p-3">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-indigo-200 text-indigo-600 cursor-pointer bg-indigo-50/40">
                          <UploadCloud size={16} />
                          <span className="text-sm font-medium">{course.thumbnail ? "Change thumbnail" : "Upload thumbnail"}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => setThumbnail(e.target.files?.[0] ?? null)} />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">Introduction Video</div>
                        <div className="text-xs text-slate-400">Required to publish</div>
                      </div>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-dashed border-gray-100 bg-white">
                      <div className="p-3">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-sky-200 text-sky-600 cursor-pointer bg-sky-50/40">
                          <Video size={16} />
                          <span className="text-sm font-medium">{course.introVideo ? "Change intro video" : "Upload intro video (required)"}</span>
                          <input type="file" accept="video/*" className="hidden" onChange={(e) => setIntroVideo(e.target.files?.[0] ?? null)} />
                        </label>
                      </div>

                      {introVideoPreview ? (
                        <div className="p-3 border-t">
                          <div className="rounded-xl overflow-hidden bg-black"><video controls src={introVideoPreview} className="w-full max-h-40" /></div>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <div className="truncate">{course.introVideo?.name ?? (introVideoPreview ? introVideoPreview.split("/").pop() : "")}</div>
                            <button onClick={() => { setIntroVideo(null); setIntroVideoPreview(null); }} className="text-red-500 hover:text-red-700">Remove</button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border-t text-xs text-slate-400">No intro video selected.</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-4 text-xs text-slate-500 shadow-sm">
                    <div className="text-sm font-semibold text-slate-700 mb-2">Metadata</div>
                    <div>Course ID: <span className="font-mono text-xs">{course.id}</span></div>
                    {course.updatedAt && <div className="mt-2">Last updated: <div className="text-xs text-slate-400">{new Date(course.updatedAt).toLocaleString()}</div></div>}
                  </div>
                </aside>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- LessonEditor — single column; quiz editor full width (layout only) ---------- */
function LessonEditor({
  lesson,
  index,
  updateLesson,
  removeLesson,
}: {
  lesson: DraftLesson;
  index: number;
  updateLesson: (p: Partial<DraftLesson>) => void;
  removeLesson: () => void;
}) {
  const [localParsed, setLocalParsed] = useState<QuizQuestion[] | null>(() =>
    lesson.__parsedQuizzes ?? (lesson.quizPreview ? safeTryParse(lesson.quizPreview) : null)
  );
  const [localQuizPreview, setLocalQuizPreview] = useState<string | null>(() =>
    lesson.quizPreview ?? (localParsed ? JSON.stringify({ quizzes: localParsed }, null, 2) : null)
  );

  const [localResourcePreview, setLocalResourcePreview] = useState<string | null>(() => {
    if (lesson.resourceFile) return URL.createObjectURL(lesson.resourceFile);
    if (lesson.resourceUrl) return lesson.resourceUrl;
    return null;
  });

  useEffect(() => {
    setLocalParsed(lesson.__parsedQuizzes ?? (lesson.quizPreview ? safeTryParse(lesson.quizPreview) : null));
    setLocalQuizPreview(lesson.quizPreview ?? (lesson.__parsedQuizzes ? JSON.stringify({ quizzes: lesson.__parsedQuizzes }, null, 2) : null));
  }, [lesson.quizPreview, lesson.__parsedQuizzes]);

  useEffect(() => {
    let objUrl: string | null = null;
    if (lesson.resourceFile) {
      try {
        objUrl = URL.createObjectURL(lesson.resourceFile);
        setLocalResourcePreview(objUrl);
      } catch {
        setLocalResourcePreview(null);
      }
    } else if (lesson.resourceUrl) {
      setLocalResourcePreview(lesson.resourceUrl);
    } else {
      setLocalResourcePreview(null);
    }
    return () => {
      if (objUrl) {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [lesson.resourceFile, lesson.resourceUrl]);

  useEffect(() => {
    console.debug(`[LessonEditor] lesson ${lesson.id} resourceUrl:`, lesson.resourceUrl, "parsedQuizzes:", lesson.__parsedQuizzes);
  }, [lesson.id, lesson.resourceUrl, lesson.__parsedQuizzes]);

  const onResourceFile = (f: File | null) => {
    updateLesson({ resourceFile: f, resourceFileName: f?.name ?? null, resourceUrl: f ? null : lesson.resourceUrl ?? null });
  };

  const removeResource = () => {
    updateLesson({ resourceFile: null, resourceFileName: null, resourceUrl: null });
    setLocalResourcePreview(null);
  };

  const addQuestion = () => {
    const base: QuizQuestion = { id: uid("q"), question: "", options: [], answer: null, appearAt: null };
    const next = (localParsed ?? []).concat([base]);
    setLocalParsed(next);
    setLocalQuizPreview(JSON.stringify({ quizzes: next }, null, 2));
    updateLesson({ quizPreview: JSON.stringify({ quizzes: next }), __parsedQuizzes: next });
  };

  const updateQuestion = (idx: number, patch: Partial<QuizQuestion>) => {
    const arr = (localParsed ?? []).map((q, i) => (i === idx ? { ...q, ...patch } : q));
    setLocalParsed(arr);
    setLocalQuizPreview(JSON.stringify({ quizzes: arr }, null, 2));
    updateLesson({ quizPreview: JSON.stringify({ quizzes: arr }), __parsedQuizzes: arr });
  };

  const removeQuestion = (idx: number) => {
    const arr = (localParsed ?? []).filter((_, i) => i !== idx);
    setLocalParsed(arr);
    setLocalQuizPreview(JSON.stringify({ quizzes: arr }, null, 2));
    updateLesson({ quizPreview: JSON.stringify({ quizzes: arr }), __parsedQuizzes: arr });
  };

  const onRawQuizJsonChange = (txt: string) => {
    setLocalQuizPreview(txt);
    try {
      const parsed = JSON.parse(txt);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.quizzes) ? parsed.quizzes : null;
      setLocalParsed(arr ?? null);
      updateLesson({ quizPreview: txt, __parsedQuizzes: arr ?? null });
    } catch {
      setLocalParsed(null);
      updateLesson({ quizPreview: txt, __parsedQuizzes: null });
    }
  };

  const fileInputId = `lesson-resource-${lesson.id}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
    >
      {/* Header: index, title, remove */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-sm font-medium text-slate-700">{index + 1}.</div>
          <input
            value={lesson.title}
            onChange={(e) => updateLesson({ title: e.target.value })}
            placeholder="Lesson title"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2"
          />
        </div>

        <div>
          <button onClick={removeLesson} className="px-3 py-2 border rounded text-red-600 hover:bg-red-50">
            Remove
          </button>
        </div>
      </div>

      {/* small control row: upload/change aligned right */}
      <div className="mt-4 flex items-center justify-end gap-3">
        <div className="text-xs text-slate-500 mr-auto">Lesson Video Preview</div>
        <label htmlFor={fileInputId} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sky-700 bg-sky-50 cursor-pointer">
          <Video size={14} />
          <span className="text-sm">{lesson.resourceFile || lesson.resourceUrl ? "Change video" : "Upload video"}</span>
        </label>
        <input id={fileInputId} type="file" accept="video/*" className="hidden" onChange={(e) => onResourceFile(e.target.files?.[0] ?? null)} />
      </div>

      {/* Video preview (16:9) — matches intro look; full width of card */}
      <div className="mt-3">
        <div className="w-full aspect-[16/9] rounded-lg overflow-hidden bg-black">
          {localResourcePreview ? (
            <video controls src={localResourcePreview} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 bg-black">No video selected</div>
          )}
        </div>

        {localResourcePreview && (
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <div className="truncate">{lesson.resourceFile?.name ?? (lesson.resourceUrl ? lesson.resourceUrl.split("/").pop() : "")}</div>
            <button onClick={removeResource} className="text-red-500 hover:text-red-700">Remove</button>
          </div>
        )}
      </div>

      {/* Quizzes — full width, no right gap */}
      <div className="mt-4 border-t pt-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">Lesson Quizzes (inline)</div>
          <div className="text-xs text-slate-500">Add questions here — raw JSON optional.</div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button onClick={addQuestion} className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">+ Add Question</button>
          <button onClick={() => { setLocalParsed(null); setLocalQuizPreview(null); updateLesson({ quizPreview: null, __parsedQuizzes: null }); }} className="text-xs px-2 py-1 rounded bg-slate-100">Clear</button>
        </div>

        {localParsed && localParsed.length > 0 && (
          <div className="mt-3 space-y-3">
            {localParsed.map((q, qi) => (
              <div key={q.id ?? qi} className="p-3 border rounded">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <input value={q.question} onChange={(e) => updateQuestion(qi, { question: e.target.value })} placeholder={`Question ${qi + 1}`} className="w-full p-2 border rounded mb-2" />
                    <input value={(q.options ?? []).join(",")} onChange={(e) => updateQuestion(qi, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Options (comma separated) — leave empty for open answer" className="w-full p-2 border rounded mb-2" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={q.answer ?? ""} onChange={(e) => updateQuestion(qi, { answer: e.target.value })} placeholder="Correct answer" className="p-2 border rounded" />
                      <input value={q.appearAt != null ? String(q.appearAt) : ""} onChange={(e) => { const v = e.target.value.trim(); const num = v === "" ? null : Number(v); updateQuestion(qi, { appearAt: num == null || Number.isNaN(num) ? null : Math.max(0, Math.floor(num)) }); }} placeholder="appearAt (seconds) optional" className="p-2 border rounded" />
                    </div>
                  </div>

                  <div className="w-28 flex flex-col items-end gap-2">
                    <button onClick={() => removeQuestion(qi)} className="px-2 py-1 rounded text-red-600 border border-red-100">Remove</button>
                  </div>
                </div>
              </div>
            ))}
            <div className="text-xs text-slate-400">Tip: leave appearAt blank to auto-distribute times across lesson duration when saving.</div>
          </div>
        )}

        {/* Raw JSON editor */}
        <div className="mt-3">
          <label className="text-xs text-slate-500">Raw quiz JSON (optional)</label>
          <textarea value={localQuizPreview ?? ""} onChange={(e) => onRawQuizJsonChange(e.target.value)} placeholder='{"quizzes":[{"question":"...","options":["a","b"],"answer":"a"}]}' className="mt-1 w-full min-h-[120px] rounded-lg border border-gray-200 p-2 text-sm" />
        </div>
      </div>
    </motion.div>
  );
}
