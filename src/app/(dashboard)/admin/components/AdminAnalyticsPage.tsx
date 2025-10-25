// app/components/AdminAnalyticsPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { MoreHorizontal, Download, Users, RefreshCw, ChevronDown } from "lucide-react";

/* ---------------- Types ---------------- */
type Employee = {
  id: string;
  name: string;
  email?: string;
  progressPercent?: number;
  coursesCompleted?: number;
  lastActive?: string;
  timeline?: Array<{ date: string; event: string; detail?: string }>;
  courseProgress?: Array<{ courseId: string; courseName: string; lastActivity?: string }>;
};

type OrgFromApi = {
  id: string;
  name?: string;
  short?: string;
  metrics?: { activeUsers?: number; revenue?: number; courses?: number; newSignups?: number };
  timeseries?: Array<{ date: string; users?: number; revenue?: number; courses?: number }>;
};

type TimeseriesPoint = { date: string; users: number; revenue: number; courses: number };

type Org = {
  id: string;
  name: string;
  short: string;
  metrics: { activeUsers: number; revenue: number; courses: number; newSignups?: number };
  timeseries: TimeseriesPoint[];
  employees: Employee[];
};

type Course = { id: string; title: string; url?: string };
type Assignment = { id: string; orgId: string; courseId: string; employeeIds: string[]; createdAt: string };

/* ------------- Small UI helpers ------------- */
function acronym(name?: string) {
  if (!name) return "";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function lastNDatesWeeks(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function buildSyntheticTimeseriesForOrg(o: OrgFromApi, employees: Employee[] = []): TimeseriesPoint[] {
  const baseDates = lastNDatesWeeks(6);
  const total = employees.length || (o.metrics?.activeUsers ?? 0) || 0;
  const points = baseDates.map((d, idx) => {
    const users = Math.round((total / baseDates.length) * (idx + 1));
    const revenue = Math.round(((o.metrics?.revenue ?? 0) / baseDates.length) * (idx + 1));
    const courses = Math.max(
      0,
      Math.round(((o.metrics?.courses ?? Math.max(1, Math.round((employees.length || 0) / 3))) / baseDates.length) * (idx + 1))
    );
    return { date: d, users, revenue, courses };
  });
  return points;
}

function normalizeTimeseries(
  ts?: Array<{ date: string; users?: number; revenue?: number; courses?: number }>
): TimeseriesPoint[] {
  if (!Array.isArray(ts) || ts.length === 0) return buildSyntheticTimeseriesForOrg({ id: "" });
  return ts.map((t) => ({
    date: t.date,
    users: typeof t.users === "number" ? t.users : 0,
    revenue: typeof t.revenue === "number" ? t.revenue : 0,
    courses: typeof t.courses === "number" ? t.courses : 0,
  }));
}

function downloadCSV(filename: string, rows: any[]) {
  if (!rows || rows.length === 0) {
    alert("No rows to download");
    return;
  }
  const header = Object.keys(rows[0] || {});
  const csv =
    [header.join(",")]
      .concat(
        rows.map((r) =>
          header
            .map((h) => {
              const val = r[h];
              if (val === null || val === undefined) return '""';
              return `"${String(val).replace(/"/g, '""')}"`;
            })
            .join(",")
        )
      )
      .join("\n") || "";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildOrgEmployeeRows(org: Org) {
  return (org.employees || []).map((e) => ({
    orgId: org.id,
    orgName: org.name,
    employeeId: e.id,
    employeeName: e.name,
    email: e.email ?? "",
    progressPercent: e.progressPercent ?? 0,
    coursesCompleted: e.coursesCompleted ?? 0,
    lastActive: e.lastActive ?? "",
  }));
}
function buildAllOrgsRows(orgs: Org[]) {
  return orgs.flatMap((o) => buildOrgEmployeeRows(o));
}

/* ---------------- Circular progress component ---------------- */
function CircularProgress({ size = 56, stroke = 6, value = 0 }: { size?: number; stroke?: number; value?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const offset = circumference - (circumference * clamped) / 100;

  return (
    <svg width={size} height={size} className="block">
      <defs>
        <linearGradient id="grad1" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={radius} fill="transparent" stroke="#eef2ff" strokeWidth={stroke} />
        <circle
          r={radius}
          fill="transparent"
          stroke="url(#grad1)"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90)"
        />
        <text x="0" y="4" textAnchor="middle" fontSize={12} fontWeight={600} fill="#0f172a">
          {clamped}%
        </text>
      </g>
    </svg>
  );
}

/* ---------------- Component ---------------- */
export default function AdminAnalyticsPage() {
  const [orgsState, setOrgsState] = useState<Org[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [reportEmployee, setReportEmployee] = useState<Employee | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [rOrgs, rCourses, rAssignments] = await Promise.all([
        fetch("/api/admin/orgs"),
        fetch("/api/admin/courses"),
        fetch("/api/admin/assignments"),
      ]);

      const orgsJson = rOrgs.ok ? await rOrgs.json() : [];
      const coursesJson = rCourses.ok ? await rCourses.json() : [];
      const assignJson = rAssignments.ok ? await rAssignments.json() : [];

      const orgsBuilt: Org[] = [];

      if (Array.isArray(orgsJson)) {
        const fetchEmployeesPromises = (orgsJson as OrgFromApi[]).map(async (oRaw) => {
          try {
            const empRes = await fetch(`/api/admin/orgs/${encodeURIComponent(oRaw.id)}/employees`);
            const emps = empRes.ok ? (await empRes.json()) : [];
            const employees = Array.isArray(emps) ? (emps as Employee[]) : [];

            const activeUsers = employees.length || (oRaw.metrics?.activeUsers ?? 0);
            const revenue = oRaw.metrics?.revenue ?? 0;
            const coursesCount = oRaw.metrics?.courses ?? (employees.length ? Math.max(1, Math.round(employees.length / 3)) : 0);
            const timeseries = oRaw.timeseries && oRaw.timeseries.length > 0 ? normalizeTimeseries(oRaw.timeseries) : buildSyntheticTimeseriesForOrg(oRaw, employees);

            const built: Org = {
              id: oRaw.id,
              name: oRaw.name || `Org ${oRaw.id}`,
              short: oRaw.short || (oRaw.name ? acronym(oRaw.name) : oRaw.id.slice(0, 2).toUpperCase()),
              metrics: { activeUsers, revenue, courses: coursesCount, newSignups: oRaw.metrics?.newSignups ?? 0 },
              timeseries,
              employees,
            };
            return built;
          } catch (e) {
            console.warn("Per-org employee fetch error for", oRaw.id, e);
            const fallbackOrg: Org = {
              id: oRaw.id,
              name: oRaw.name || `Org ${oRaw.id}`,
              short: oRaw.short || (oRaw.name ? acronym(oRaw.name) : oRaw.id.slice(0, 2).toUpperCase()),
              metrics: { activeUsers: 0, revenue: oRaw.metrics?.revenue ?? 0, courses: oRaw.metrics?.courses ?? 0, newSignups: oRaw.metrics?.newSignups ?? 0 },
              timeseries: oRaw.timeseries && oRaw.timeseries.length > 0 ? normalizeTimeseries(oRaw.timeseries) : buildSyntheticTimeseriesForOrg(oRaw, []),
              employees: [],
            };
            return fallbackOrg;
          }
        });

        const builtAll = await Promise.all(fetchEmployeesPromises);
        orgsBuilt.push(...builtAll);
      }

      const fallback = [
        {
          id: "org_demo",
          name: "Demo Org",
          short: "DO",
          metrics: { activeUsers: 12, revenue: 2400, courses: 4 },
          timeseries: buildSyntheticTimeseriesForOrg({ id: "org_demo", name: "Demo Org" }, []),
          employees: [],
        },
      ];

      setOrgsState(orgsBuilt.length ? orgsBuilt : fallback);
      setCourses(Array.isArray(coursesJson) ? (coursesJson as Course[]) : []);
      setAssignments(Array.isArray(assignJson) ? (assignJson as Assignment[]) : []);
      setSelectedOrgId((prev) => prev ?? (orgsBuilt[0]?.id ?? fallback[0].id));
    } catch (err) {
      console.error("AdminAnalytics fetch error:", err);
      setError("Failed to load analytics. Showing fallback data.");
      setOrgsState([
        {
          id: "org_demo",
          name: "Demo Org",
          short: "DO",
          metrics: { activeUsers: 12, revenue: 2400, courses: 4 },
          timeseries: buildSyntheticTimeseriesForOrg({ id: "org_demo", name: "Demo Org" }, []),
          employees: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orgs = useMemo(() => orgsState, [orgsState]);
  const selectedOrg = useMemo(() => orgs.find((o) => o.id === selectedOrgId) ?? orgs[0] ?? null, [orgs, selectedOrgId]);

  const filteredOrgs = useMemo(() => {
    if (!query.trim()) return orgs;
    const q = query.toLowerCase();
    return orgs.filter((o) => (o.name || "").toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
  }, [orgs, query]);

  function exportSelectedOrgCSV() {
    if (!selectedOrg) return;
    const rows = buildOrgEmployeeRows(selectedOrg);
    if (rows.length) downloadCSV(`${selectedOrg.name.replace(/\s+/g, "_")}_employees.csv`, rows);
    else alert("No employees to export");
  }

  function exportAllOrgsCSV() {
    const rows = buildAllOrgsRows(orgs);
    if (rows.length) downloadCSV(`all_organisations_employees.csv`, rows);
    else alert("No rows to export");
  }

  function openEmployeeReport(empId: string) {
    const emp =
      (selectedOrg?.employees || []).find((e) => e.id === empId) ??
      orgs.flatMap((o) => o.employees).find((e) => e.id === empId) ??
      null;
    setReportEmployee(emp);
  }
  function closeEmployeeReport() {
    setReportEmployee(null);
  }

  function findCourseTitle(id: string) {
    return courses.find((c) => c.id === id)?.title ?? id;
  }
  function findOrgName(id: string) {
    return orgs.find((o) => o.id === id)?.name ?? id;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Analytics</h2>
          <p className="text-sm text-slate-500">Organization & employee performance overview</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border rounded px-3 py-2">
            <Users />
            <div className="text-sm">Total orgs<span className="ml-2 font-semibold">{orgs.length}</span></div>
          </div>
          <button onClick={fetchData} className="px-3 py-2 border rounded inline-flex items-center gap-2 text-sm">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={exportAllOrgsCSV} className="px-3 py-2 bg-indigo-600 text-white rounded inline-flex items-center gap-2 text-sm">
            <Download size={14} /> Export all
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-slate-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: selector & quick list */}
        <aside className="lg:col-span-3 bg-white rounded-lg p-4 shadow">
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1">Select organisation</label>
            <div className="relative">
              <select
                value={selectedOrgId ?? ""}
                onChange={(e) => setSelectedOrgId(e.target.value || null)}
                className="w-full rounded-md border px-3 py-2 pr-10 text-sm appearance-none"
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <div className="mb-3">
            <input
              placeholder="Search org"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2 max-h-[48vh] overflow-auto">
            {filteredOrgs.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOrgId(o.id)}
                className={`w-full text-left p-3 rounded-md hover:bg-slate-50 flex items-center gap-3 ${selectedOrg?.id === o.id ? "ring-2 ring-indigo-200" : ""}`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-50 to-cyan-50 flex items-center justify-center font-medium text-indigo-700">
                  {o.short}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-slate-400">{o.metrics.activeUsers} users • {o.metrics.courses} courses</div>
                </div>
                <div className="text-sm text-slate-600">₹{o.metrics.revenue}</div>
              </button>
            ))}
            {filteredOrgs.length === 0 && <div className="text-sm text-slate-500">No organisations found</div>}
          </div>
        </aside>

        {/* CENTER: metrics & chart */}
        <main className="lg:col-span-6 bg-white rounded-lg p-5 shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-slate-500">Selected organisation</div>
              <div className="text-xl font-semibold">{selectedOrg?.name}</div>
              <div className="text-xs text-slate-400">{(selectedOrg?.employees.length ?? 0)} employees</div>
            </div>

            <div className="flex gap-2 items-center">
              <button onClick={exportSelectedOrgCSV} className="px-3 py-2 border rounded inline-flex items-center gap-2 text-sm">
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-slate-500">Active users</div>
              <div className="font-semibold text-lg">{selectedOrg?.metrics.activeUsers ?? 0}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-slate-500">Revenue</div>
              <div className="font-semibold text-lg">₹{selectedOrg?.metrics.revenue ?? 0}</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="text-xs text-slate-500">Courses</div>
              <div className="font-semibold text-lg">{selectedOrg?.metrics.courses ?? 0}</div>
            </div>
          </div>

          <div style={{ height: 280 }} className="rounded">
            {selectedOrg?.timeseries?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedOrg.timeseries}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="users" name="Active users" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-sm text-slate-500">No timeseries data</div>
            )}
          </div>

          <div className="mt-5">
            <h4 className="font-semibold mb-3">Recent employees</h4>
            {selectedOrg && selectedOrg.employees.length === 0 && <div className="text-sm text-slate-500">No employees</div>}

            <div className="grid grid-cols-1 gap-3 max-h-72 overflow-auto">
              {(selectedOrg?.employees || []).map((e) => (
                <div key={e.id} className="p-3 border rounded-lg flex items-center gap-4">
                  <div>
                    <CircularProgress value={e.progressPercent ?? 0} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-slate-400">{e.email}</div>
                      </div>
                      <div className="text-xs text-slate-400">{e.lastActive ? new Date(e.lastActive).toLocaleDateString() : '—'}</div>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs text-slate-400">{e.coursesCompleted ?? 0} courses • {e.progressPercent ?? 0}%</div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEmployeeReport(e.id)} className="text-sm text-indigo-600">Details</button>
                        <button onClick={() => downloadCSV(`${(e.name || 'employee').replace(/\s+/g,'_')}_summary.csv`, [
                          { name: e.name, email: e.email, progress: e.progressPercent, coursesCompleted: e.coursesCompleted }
                        ])} className="px-2 py-1 border rounded text-sm">Export</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* RIGHT: assignments & detail */}
        <aside className="lg:col-span-3 bg-white rounded-lg p-4 shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-500">Assignments</div>
            <div className="text-xs text-slate-400">{assignments.length}</div>
          </div>

          <div className="space-y-2 text-sm">
            {assignments.slice(0, 8).map((a) => (
              <div key={a.id} className="p-3 border rounded hover:bg-slate-50">
                <div className="font-medium">{findCourseTitle(a.courseId)}</div>
                <div className="text-xs text-slate-400">{findOrgName(a.orgId)} • {new Date(a.createdAt).toLocaleDateString()}</div>
              </div>
            ))}
            {assignments.length === 0 && <div className="text-sm text-slate-500">No assignments yet.</div>}

            <div className="mt-4">
              <h5 className="text-sm font-medium mb-2">Quick actions</h5>
              <div className="flex flex-col gap-2">
                <button onClick={() => exportAllOrgsCSV()} className="px-3 py-2 border rounded text-sm text-left">Export all employees</button>
                <button onClick={() => alert('Feature: Create assignment')} className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">Create assignment</button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Employee report modal */}
      {reportEmployee && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeEmployeeReport} />
          <div className="relative bg-white rounded-lg p-6 z-10 max-w-3xl w-full shadow-lg">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-semibold">{reportEmployee.name}</div>
                <div className="text-xs text-slate-400">{reportEmployee.email}</div>
              </div>
              <button onClick={closeEmployeeReport} className="p-2 rounded border"><MoreHorizontal /></button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-slate-500">Overall progress</div>
                <div className="text-2xl font-semibold">{reportEmployee.progressPercent ?? 0}%</div>
                <div className="mt-3 text-sm text-slate-500">Courses completed: {reportEmployee.coursesCompleted ?? 0}</div>
              </div>

              <div>
                <div className="text-sm text-slate-500">Course progress</div>
                <div className="space-y-2 mt-2">
                  {(reportEmployee.courseProgress || []).map((cp) => (
                    <div key={cp.courseId} className="p-2 border rounded">
                      <div className="font-medium">{cp.courseName || cp.courseId}</div>
                      <div className="text-xs text-slate-400">{cp.lastActivity ?? "—"}</div>
                    </div>
                  ))}
                  {(reportEmployee.courseProgress || []).length === 0 && <div className="text-sm text-slate-500">No course progress yet.</div>}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={() => downloadCSV(`${reportEmployee.name.replace(/\s+/g, "_")}_courses.csv`, reportEmployee.courseProgress || [])} className="px-3 py-2 bg-indigo-600 text-white rounded inline-flex items-center gap-2">
                <Download size={14} /> Export courses
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
