// compliance_portal/src/lib/courseUtils.ts
export type Section = {
  id: string;
  title: string;
  duration?: number | string | null;
  type?: "video" | "quiz";
  videoUrl?: string | null;
  resourceUrl?: string | null;
  lesson?: any;
  [k: string]: any;
};

export function parseTimeToSeconds(input: any): number | null {
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

export function splitOptionString(s: string): string[] {
  if (!s) return [];
  const separators = [";", "|", ","];
  for (const sep of separators) {
    if (s.includes(sep)) {
      return s.split(sep).map((p) => p.trim()).filter(Boolean);
    }
  }
  return s.split(/\r?\n/).map((p) => p.trim()).filter(Boolean);
}

export function normalizeOptions(opts: any): any[] | undefined {
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

export function arraysEqual(a: any[], b: any[]) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (String(a[i]) !== String(b[i])) return false;
  return true;
}

export function extractQuizzesFromLesson(lessonObj: any): any[] {
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
    ) return true;
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
    if (typeof o === "object") Object.values(o).forEach((v) => walk(v, depth + 1));
  };
  walk(lessonObj, 0);
  if (foundArrays.length > 0) return foundArrays[0];
  return [];
}

export function getQuestionText(item: any, fallbackLabel = "Answer this:") {
  if (!item) return fallbackLabel;
  const keys = ["prompt", "question", "title", "stem", "text", "label", "body", "question_text", "question_html", "questionHtml"];
  for (const k of keys) {
    const v = item[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  if (typeof item === "string" && item.trim() !== "") return item.trim();
  return fallbackLabel;
}

export function getOptionLabel(opt: any) {
  if (opt == null) return "";
  if (typeof opt === "string") return opt.trim();
  if (typeof opt === "number") return String(opt);
  const keys = ["label", "text", "value", "title", "name", "id", "option"];
  for (const k of keys) {
    if (opt[k] != null && String(opt[k]).trim() !== "") return String(opt[k]).trim();
  }
  try { return JSON.stringify(opt); } catch { return String(opt); }
}

export function getOptionValue(opt: any, idx?: number) {
  if (opt == null) return `__opt_null_${idx ?? 0}`;
  if (typeof opt === "string") return opt;
  if (typeof opt === "number") return String(opt);
  if (typeof opt === "object") {
    if (opt.value != null) return String(opt.value);
    if (opt.id != null) return String(opt.id);
    if (opt.name != null) return String(opt.name);
    if (opt.option != null) return String(opt.option);
    if (opt.label != null) return String(opt.label);
    try { return JSON.stringify(opt); } catch { return `__opt_obj_${idx ?? 0}`; }
  }
  return String(opt);
}

export function formatTime(sec: number | null | undefined) {
  if (sec == null || !isFinite(sec) || sec <= 0) return "00:00";
  const s = Math.floor(sec);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
  return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

export function computeTotalQuizzes(courseObj: any) {
  if (!courseObj) return 0;
  let total = 0;
  (courseObj.sections ?? []).forEach((s:any) => {
    const qs = extractQuizzesFromLesson(s.lesson) ?? [];
    total += qs.length;
  });
  return total;
}
