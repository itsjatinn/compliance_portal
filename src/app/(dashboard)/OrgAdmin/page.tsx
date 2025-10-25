"use client";

import React, { JSX, useEffect, useMemo, useState } from "react";
import { Mail, Scale, X, Award, Users, BarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* same types and dummy data as before */
type Quiz = { title: string; score: number; outOf: number };
type CourseProgress = { courseId: string; title: string; progressPct: number; certificateGenerated: boolean };

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarColor: string;
  courses: CourseProgress[];
  quizzes: Quiz[];
  notifications?: { id: string; message: string; when: string; from?: string }[];
};

const STORAGE_KEY = "org:notifications";

const DUMMY_EMPLOYEES: Employee[] = [
  { id: "e1", name: "Aisha Khan", email: "aisha.khan@example.com", role: "Customer Support", avatarColor: "bg-pink-400",
    courses: [{ courseId: "c1", title: "Onboarding", progressPct: 100, certificateGenerated: true }, { courseId: "c2", title: "Product Knowledge", progressPct: 75, certificateGenerated: false }],
    quizzes: [{ title: "Onboarding Quiz", score: 9, outOf: 10 }, { title: "Product Quiz 1", score: 7, outOf: 10 }] },
  { id: "e2", name: "Harshit Gour", email: "harshit.gour@example.com", role: "Kamchor", avatarColor: "bg-indigo-400",
    courses: [{ courseId: "c1", title: "Onboarding", progressPct: 100, certificateGenerated: true }, { courseId: "c3", title: "Sales Basics", progressPct: 10, certificateGenerated: false }],
    quizzes: [{ title: "Sales Quiz", score: 6, outOf: 10 }] },
  { id: "e3", name: "Pooja Sharma", email: "pooja.sharma@example.com", role: "Developer", avatarColor: "bg-green-400",
    courses: [{ courseId: "c1", title: "Onboarding", progressPct: 100, certificateGenerated: true }, { courseId: "c4", title: "Security Awareness", progressPct: 20, certificateGenerated: false }],
    quizzes: [{ title: "Security Quiz", score: 4, outOf: 10 }] },
];

// StatCard (unchanged)
function StatCard({ title, value, sub, icon }: { title: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="bg-gradient-to-tr from-indigo-950 via-indigo-900 to-indigo-800 rounded-2xl p-5 text-white shadow-lg border border-indigo-700">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-white/10 grid place-items-center text-amber-400">{icon}</div>
        <div>
          <div className="text-xs text-indigo-200">{title}</div>
          <div className="text-lg font-semibold text-white">{value}</div>
          {sub && <div className="text-xs text-white/60 mt-1">{sub}</div>}
        </div>
      </div>
    </motion.div>
  );
}

/* ---- Updated component: uses same auth/local logic as your employee page (auth_user + auth:changed) ---- */

const LOCAL_USER_KEY = "auth_user";
const AUTH_CHANGED_EVENT = "auth:changed";

function formatNameFromEmail(email?: string, fallback = "User") {
  if (!email) return fallback;
  const local = email.split("@")[0] || fallback;
  return local
    .split(/[.\-_+]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

function readLocalUser(): { name: string; email: string } | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LOCAL_USER_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    const userObj = parsed.user ?? parsed;
    if (!userObj || !userObj.email) return null;
    return {
      name: userObj.name ?? formatNameFromEmail(userObj.email),
      email: userObj.email,
    };
  } catch {
    return null;
  }
}

export default function OrganisationAdminDashboard(): JSX.Element {
  const [employees, setEmployees] = useState<Employee[]>(DUMMY_EMPLOYEES);
  const [lookupQuery, setLookupQuery] = useState("");
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(DUMMY_EMPLOYEES[0]?.id ?? null);
  const [isEmailOpen, setEmailOpen] = useState(false);
  const [emailBody, setEmailBody] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; to?: string; message: string; when: string }[]>([]);
  const [filter, setFilter] = useState<"all" | "completed" | "completed_no_cert" | "cert_generated">("all");

  // Use same currentUser approach as Employee page
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setNotifications(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  // Hydrate & listen for auth changes (copied behavior from page.tsx)
  useEffect(() => {
    let mounted = true;
    const local = readLocalUser();
    if (local) setCurrentUser(local);

    // try to call /api/auth/me if available (best-effort; doesn't break if absent)
    async function fetchMe(retry = true) {
      try {
        const res = await fetch("/api/auth/me", { method: "GET", credentials: "include", headers: { Accept: "application/json" } });
        if (res.status === 401 && retry) {
          await new Promise((r) => setTimeout(r, 200));
          return fetchMe(false);
        }
        if (res.status === 401) {
          // not authenticated - keep local fallback
          return;
        }
        const data = await res.json().catch(() => ({}));
        const user = data?.user ?? data;
        if (mounted && user?.email) {
          const resolved = { name: user?.name || formatNameFromEmail(user.email), email: user.email };
          setCurrentUser(resolved);
          try {
            localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
            window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
          } catch (e) {
            // ignore
          }
        }
      } catch (err) {
        // network or missing endpoint -> ignore (we already have local fallback)
      }
    }
    fetchMe();

    const onAuthChanged = () => {
      const latest = readLocalUser();
      setCurrentUser(latest);
    };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_USER_KEY) onAuthChanged();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const selectedEmployee = employees.find((e) => e.id === selectedEmpId) ?? null;

  function overallProgressFor(emp: Employee) {
    const len = emp.courses.length;
    return len ? Math.round(emp.courses.reduce((s, c) => s + c.progressPct, 0) / len) : 0;
  }

  const kpis = useMemo(() => {
    const active = employees.length;
    const avg = Math.round(employees.reduce((s, e) => s + overallProgressFor(e), 0) / Math.max(1, employees.length));
    const certs = employees.reduce((s, e) => s + e.courses.filter((c) => c.certificateGenerated).length, 0);
    return { active, avg, certs };
  }, [employees]);

  // Quick lookup filtering (unchanged)
  const filteredEmployees = useMemo(() => {
    const q = lookupQuery.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.role.toLowerCase().includes(q));
  }, [employees, lookupQuery]);

  useEffect(() => {
    if (filteredEmployees.length === 0) {
      setSelectedEmpId(null);
      return;
    }
    if (selectedEmpId && filteredEmployees.some((f) => f.id === selectedEmpId)) return;
    setSelectedEmpId(filteredEmployees[0].id);
  }, [filteredEmployees]);

  function pushNotification(to: string | undefined, message: string) {
    const note = { id: String(Date.now()), to, message, when: new Date().toISOString() };
    setNotifications((prev) => [note, ...prev].slice(0, 100));
  }

  // open quick email with employee prefilled
  function openQuickEmail(emp?: Employee) {
    setEmailTo(emp?.email || "");
    setEmailBody(emp ? `Hi ${emp.name},\n\nThis is a quick reminder to complete your pending courses.\n\nBest,\nOrg Admin` : `Hi team,\n\nPlease complete your pending courses.\n\nThanks,\nOrg Admin`);
    setEmailOpen(true);
  }

  async function handleSend() {
    setSending(true);
    pushNotification(emailTo || undefined, `Reminder sent: ${emailBody.split("\n")[0] || "(no subject)"}`);
    setTimeout(() => {
      setSending(false);
      setEmailOpen(false);
      alert("Reminder sent (simulated).");
    }, 600);
  }

  // Generate CSV report for selected employee and trigger download
  function generateReport(emp: Employee | null) {
    if (!emp) return alert("No employee selected.");
    const rows: string[][] = [];
    // header
    rows.push(["Employee ID", "Name", "Email", "Role"]);
    rows.push([emp.id, emp.name, emp.email, emp.role]);
    rows.push([]);
    rows.push(["Course ID", "Course Title", "Progress (%)", "Certificate Generated"]);
    for (const c of emp.courses) {
      rows.push([c.courseId, c.title, String(c.progressPct), c.certificateGenerated ? "Yes" : "No"]);
    }
    rows.push([]);
    rows.push(["Quiz Title", "Score", "Out Of"]);
    for (const q of emp.quizzes) {
      rows.push([q.title, String(q.score), String(q.outOf)]);
    }

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${emp.name.replace(/\s+/g, "_")}_report.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushNotification(emp.email, "Report generated");
  }

  // Prepare chart data for selected employee (courses as points)
  const courseChartData = useMemo(() => {
    if (!selectedEmployee) return [];
    // sort courses in order provided but ensure values are numeric
    return selectedEmployee.courses.map((c, idx) => ({ name: c.title, value: Number(c.progressPct), idx }));
  }, [selectedEmployee]);

  // Derived metrics for the graph card
  const graphMetrics = useMemo(() => {
    if (!selectedEmployee || selectedEmployee.courses.length === 0) return null;
    const values = selectedEmployee.courses.map((c) => c.progressPct);
    const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
    const bestIdx = values.indexOf(Math.max(...values));
    const worstIdx = values.indexOf(Math.min(...values));
    return {
      avg,
      best: selectedEmployee.courses[bestIdx],
      worst: selectedEmployee.courses[worstIdx],
    };
  }, [selectedEmployee]);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-[1400px] -mt-8 mx-auto p-4 ">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-6">
          <div className="bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-800 rounded-3xl p-5 shadow-xl flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-white/6"><Scale className="text-amber-300" /></div>
              <div>
                <h1 className="text-lg font-semibold">Organization Admin</h1>
                <div className="text-sm text-white/80">Manage your organization's learners</div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/6 px-3 py-1 rounded-full">
              <div className="w-8 h-8 rounded-full bg-amber-300 grid place-items-center text-indigo-900 font-semibold">{((currentUser?.name ?? "A").charAt(0) || "A").toUpperCase()}</div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium">{currentUser?.name ?? "Admin"}</div>
                <div className="text-xs text-white/70">{currentUser?.email ?? "Organization"}</div>
              </div>
              {/* Notification icon intentionally removed per request */}
            </div>
          </div>
        </motion.header>

        {/* KPI Cards */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard title="Active Learners" value={`${kpis.active}`} sub="Total enrolled" icon={<Users className="w-4 h-4 stroke-current" />} />
          <StatCard title="Average Progress" value={`${kpis.avg}%`} sub="Across all courses" icon={<BarChart2 className="w-4 h-4 stroke-current" />} />
          <StatCard title="Certificates" value={`${kpis.certs}`} sub="Issued so far" icon={<Award className="w-4 h-4 stroke-current" />} />
        </motion.div>

        {/* Main grid: Quick lookup, list, details (unchanged) */}
        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-7 space-y-4">
            <div className="bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-800 p-4 rounded-2xl shadow-lg border border-indigo-700 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Quick Lookup</div>
                <div className="text-xs text-indigo-200">Search by name, email or role</div>
              </div>
              <div className="flex gap-2 items-center">
                <input value={lookupQuery} onChange={(e) => setLookupQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && filteredEmployees.length) setSelectedEmpId(filteredEmployees[0].id); }} className="flex-1 rounded p-2 bg-indigo-900/20 border border-indigo-700 text-sm placeholder:text-indigo-300" placeholder="Type name, email or role and press Enter" />
                {lookupQuery ? (<button onClick={() => setLookupQuery("")} aria-label="clear" className="px-2 py-1 rounded bg-indigo-900/30"><X className="w-4 h-4" /></button>) : null}
                <button onClick={() => { if (filteredEmployees.length) setSelectedEmpId(filteredEmployees[0].id); else alert("No employees found"); }} className="px-3 py-2 rounded bg-amber-400 text-indigo-900 font-medium">Open</button>
              </div>
            </div>

            <div className="bg-gradient-to-t from-indigo-950 via-indigo-900 to-indigo-800 p-4 rounded-2xl shadow-lg border border-indigo-700 text-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Employees</h2>
                <div className="flex items-center gap-4"><div className="text-sm text-indigo-200">Showing {filteredEmployees.length} results</div></div>
              </div>

              <div className="space-y-3">
                {filteredEmployees.length === 0 ? (<div className="text-indigo-300 py-6 text-center">No employees match that query.</div>) : (filteredEmployees.map((emp) => (
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.985 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    key={emp.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedEmpId === emp.id}
                    className={`p-3 rounded flex items-center justify-between border border-indigo-800 hover:bg-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-amber-400 transition cursor-pointer ${selectedEmpId === emp.id ? "border-amber-300 bg-indigo-900/30" : ""}`}
                    onClick={() => setSelectedEmpId(emp.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedEmpId(emp.id); } }}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div whileTap={{ scale: 0.9 }} className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${emp.avatarColor}`}>{emp.name[0]}</motion.div>
                      <div><div className="font-medium">{emp.name}</div><div className="text-xs text-indigo-200">{emp.role} • {emp.email}</div></div>
                    </div>
                    <div className="text-sm text-indigo-200">Progress: {overallProgressFor(emp)}%</div>
                  </motion.div>
                )))}
              </div>
            </div>
          </section>

          <aside className="col-span-5 bg-gradient-to-b from-indigo-950 via-indigo-900 to-indigo-800 p-5 rounded-2xl shadow-lg border border-indigo-700 text-white">
            {selectedEmployee ? (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${selectedEmployee.avatarColor} text-xl`}>{selectedEmployee.name[0]}</div>
                    <div>
                      <div className="font-semibold text-lg">{selectedEmployee.name}</div>
                      <div className="text-sm text-indigo-200">{selectedEmployee.role} • {selectedEmployee.email}</div>
                    </div>
                  </div>

                  {/* Actions: Send email + Generate report */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => openQuickEmail(selectedEmployee)} className="px-3 py-2 rounded bg-indigo-900/20 border border-indigo-700 text-sm"> <Mail className="inline w-4 h-4 mr-2" /> Send Email</button>
                    <button onClick={() => generateReport(selectedEmployee)} className="px-3 py-2 rounded bg-amber-400 text-indigo-900 font-medium text-sm">Generate Report</button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-indigo-200">Overall progress</div>
                  <div className="text-2xl font-bold">{overallProgressFor(selectedEmployee)}%</div>
                </div>

                {/* Professional Graph Card */}
                <div className="bg-gradient-to-tr from-indigo-900/10 to-indigo-900/6 border border-indigo-800 rounded-md p-4 mb-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="text-sm font-medium text-indigo-100">Course progress (curve)</div>
                      <div className="text-xs text-indigo-300">A quick view of progress across assigned courses</div>
                    </div>
                    {graphMetrics && (
                      <div className="flex items-center gap-3 text-xs text-indigo-200">
                        <div className="text-center">
                          <div className="text-amber-400 font-semibold text-lg">{graphMetrics.avg}%</div>
                          <div className="text-indigo-300">Avg</div>
                        </div>
                        <div className="text-center">
                          <div className="text-emerald-400 font-semibold text-sm">{graphMetrics.best.title}</div>
                          <div className="text-indigo-300">Best</div>
                        </div>
                        <div className="text-center">
                          <div className="text-rose-400 font-semibold text-sm">{graphMetrics.worst.title}</div>
                          <div className="text-indigo-300">Lowest</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ width: "100%", height: 220 }}>
                    {courseChartData.length > 0 ? (
                      <ResponsiveContainer>
                        <LineChart data={courseChartData} margin={{ top: 6, right: 12, left: -12, bottom: 6 }}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-xs text-indigo-200 py-6 text-center">No course data to render.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-indigo-100 mb-2">Courses</h3>
                    {selectedEmployee.courses.map((c) => (
                      <div key={c.courseId} className="p-3 border border-indigo-700 rounded flex items-center justify-between">
                        <div>
                          <div className="font-medium">{c.title}</div>
                          <div className="text-xs text-indigo-200 mt-1">Progress: {c.progressPct}%</div>
                          <div className="w-52 bg-indigo-900/20 h-2 rounded mt-2"><div style={{ width: `${c.progressPct}%` }} className="h-2 rounded bg-amber-400" /></div>
                        </div>
                        <div className="text-sm">{c.certificateGenerated ? (<span className="text-emerald-400 font-medium">Generated</span>) : (<span className="text-indigo-200">Pending</span>)}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="font-medium text-indigo-100 mb-2">Quizzes</h3>
                    <table className="w-full text-sm text-indigo-200">
                      <thead className="text-xs text-indigo-300 text-left"><tr><th>Title</th><th>Score</th></tr></thead>
                      <tbody>{selectedEmployee.quizzes.map((q, i) => (<tr key={i} className="border-t border-indigo-800"><td className="py-2">{q.title}</td><td className="py-2">{q.score} / {q.outOf}</td></tr>))}</tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-indigo-200">Select an employee to view details</div>
            )}
          </aside>
        </div>
      </div>

      {/* Email modal (simple inline modal) */}
      {isEmailOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">Send Email</h3>
              <button onClick={() => setEmailOpen(false)} className="text-slate-500 hover:text-slate-700"><X /></button>
            </div>

            <div className="space-y-3 text-sm text-slate-800">
              <label className="block">
                <div className="text-xs text-slate-500 mb-1">To</div>
                <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="w-full p-2 rounded border" />
              </label>

              <label className="block">
                <div className="text-xs text-slate-500 mb-1">Body</div>
                <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={6} className="w-full p-2 rounded border" />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button onClick={() => { setEmailOpen(false); }} className="px-3 py-2 rounded border">Cancel</button>
                <button onClick={() => handleSend()} className="px-4 py-2 rounded bg-amber-400 text-indigo-900 font-medium" disabled={sending}>{sending ? "Sending…" : "Send"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
