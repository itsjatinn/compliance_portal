"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ClipboardList,
  Search as IconSearch,
  Users as IconUsers,
  Check as IconCheck,
  Copy as IconCopy,
} from "lucide-react";

type Org = { id: string; name: string };
type Course = { id: string; title: string };
type Employee = { id: string; name?: string | null; email?: string | null };

// Props: apiBase (defaults to /api/admin), onClose, currentUserId, and optional onAssigned callback
export default function AssignCoursePanel({
  apiBase = "/api/admin",
  onClose,
  currentUserId,
  onAssigned,
}: {
  apiBase?: string;
  onClose?: () => void;
  currentUserId?: string | null;
  onAssigned?: (results: any[]) => void;
}) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Record<string, boolean>>({});
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingAssign, setLoadingAssign] = useState(false);

  const [createMissingUsers, setCreateMissingUsers] = useState(false);

  // show temporary credentials returned by the server
  const [tempCredentialsByUser, setTempCredentialsByUser] = useState<Record<string, string>>({});

  // --- Utility ---
  const dedupeById = <T extends { id?: string }>(arr: T[] = []) => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of arr) {
      const id = item?.id ?? "";
      if (!id) {
        out.push(item);
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
    return out;
  };

  // --- Load orgs & courses ---
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingOrgs(true);
      setLoadingCourses(true);
      try {
        const [orgRes, courseRes] = await Promise.all([
          fetch(`${apiBase}/orgs`, { credentials: "include" }),
          fetch(`${apiBase}/courses`, { credentials: "include" }),
        ]);

        if (mounted) {
          if (orgRes.ok) {
            const data = (await orgRes.json().catch(() => [])) as Org[];
            setOrgs(data || []);
            if (!selectedOrg && data?.[0]?.id) setSelectedOrg(data[0].id);
          }
          if (courseRes.ok) {
            const data = (await courseRes.json().catch(() => [])) as Course[];
            setCourses(dedupeById(data || []));
            if (!selectedCourse && data?.[0]?.id) setSelectedCourse(data[0].id);
          }
        }
      } catch (err) {
        console.warn("Failed to load orgs/courses", err);
      } finally {
        if (mounted) {
          setLoadingOrgs(false);
          setLoadingCourses(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  // --- Load employees when org changes ---
  useEffect(() => {
    let mounted = true;
    if (!selectedOrg) {
      setEmployees([]);
      setSelectedEmployeeIds({});
      setSelectAllChecked(false);
      return;
    }

    (async () => {
      setLoadingEmployees(true);
      try {
        const res = await fetch(`${apiBase}/orgs/${encodeURIComponent(selectedOrg)}/employees`, {
          credentials: "include",
        });

        if (!mounted) return;
        if (!res.ok) {
          setEmployees([]);
          setSelectedEmployeeIds({});
          setSelectAllChecked(false);
          return;
        }

        const data = (await res.json().catch(() => [])) as Employee[];
        setEmployees(data || []);
        setSelectedEmployeeIds({});
        setSelectAllChecked(false);
      } catch (err) {
        console.warn("Failed to load employees", err);
        setEmployees([]);
      } finally {
        if (mounted) setLoadingEmployees(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedOrg, apiBase]);

  // --- Helpers ---
  const filteredEmployees = () => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.name ?? ""} ${e.email ?? ""}`.toLowerCase().includes(q)
    );
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const visible = filteredEmployees();
      const visibleSelectedCount = visible.reduce(
        (acc, e) => (next[e.id] ? acc + 1 : acc),
        0
      );
      setSelectAllChecked(visible.length > 0 && visibleSelectedCount === visible.length);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const next = !selectAllChecked;
    setSelectAllChecked(next);
    if (next) {
      const visible = filteredEmployees();
      const map: Record<string, boolean> = {};
      for (const e of visible) map[e.id] = true;
      setSelectedEmployeeIds((prev) => ({ ...prev, ...map }));
    } else {
      const visible = filteredEmployees();
      setSelectedEmployeeIds((prev) => {
        const copy = { ...prev };
        for (const e of visible) delete copy[e.id];
        return copy;
      });
    }
  };

  const selectedIds = () =>
    Object.entries(selectedEmployeeIds)
      .filter(([_, v]) => v)
      .map(([k]) => k);

  // copy credentials to clipboard
  const copyCredentials = async () => {
    const lines = Object.entries(tempCredentialsByUser).map(([uid, pwd]) => `${uid}: ${pwd}`);
    const txt = lines.join("\n");
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(txt);
        alert("Temporary credentials copied to clipboard.");
      } else {
        // fallback: prompt
        prompt("Temporary credentials (copy manually):", txt);
      }
    } catch (e) {
      console.warn("Failed to copy credentials", e);
      prompt("Temporary credentials (copy manually):", txt);
    }
  };

  // --- Assign handler ---
  async function assign() {
    if (!selectedOrg) return alert("Select an organisation");
    if (!selectedCourse) return alert("Select a course");

    const ids = selectedIds();
    if (!ids.length) return alert("Select one or more employees to assign");

    setLoadingAssign(true);
    setTempCredentialsByUser({});
    try {
      // Map id->email for selected employees
      const idToEmail: Record<string, string | null> = {};
      for (const e of employees) {
        if (e.id) idToEmail[e.id] = e.email ?? null;
      }

      const missingEmailIds: string[] = ids.filter((id) => !idToEmail[id]);
      if (missingEmailIds.length && !createMissingUsers) {
        const proceed = confirm(
          `Some selected employees do not have emails (ids: ${missingEmailIds.join(
            ", "
          )}). "Create missing users" is OFF. Continue assigning only to those with emails?`
        );
        if (!proceed) {
          setLoadingAssign(false);
          return;
        }
      }

      if (!Object.values(idToEmail).some((e) => e) && !createMissingUsers) {
        alert(
          "No selected employees have email addresses. Enable 'Create missing users' or select employees with valid emails."
        );
        setLoadingAssign(false);
        return;
      }

      const orgInfo = orgs.find((o) => o.id === selectedOrg);
      const courseInfo = courses.find((c) => c.id === selectedCourse);

      const payload = {
        orgId: selectedOrg,
        courseId: selectedCourse,
        employeeIds: ids,
        employeeEmailMap: Object.fromEntries(ids.map((id) => [id, idToEmail[id]])),
        createMissingUsers,
        meta: {
          orgName: orgInfo?.name,
          courseTitle: courseInfo?.title,
        },
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (currentUserId) headers["x-user-id"] = currentUserId;

      const res = await fetch(`${apiBase}/assign`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let body: any = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }

      if (!res.ok) {
        const serverMsg =
          body?.error || body?.message || (typeof body === "string" ? body : `Status ${res.status}`);
        alert(`Assign failed: ${serverMsg}`);
        console.error("Assign failed", { status: res.status, body });
        return;
      }

      // handle success
      if (body?.success) {
        const count =
          typeof body.assignedCount === "number"
            ? body.assignedCount
            : Array.isArray(body.results)
            ? body.results.filter((r: any) => r.assignedCreated).length
            : 0;

        // collect temp credentials
        const creds: Record<string, string> = {};
        for (const r of body.results || []) {
          const key = r.userId ?? r.employeeId ?? "unknown";
          if (r?.tempPassword) creds[key] = r.tempPassword;
        }

        if (Object.keys(creds).length) {
          setTempCredentialsByUser(creds);
          // log for admin (also copied to clipboard if desired)
          console.info("Temporary credentials for new/updated users:\n", creds);
        }

        // notify parent to refresh assigned courses / lists if provided
        onAssigned?.(body.results ?? []);

        alert(`Assigned ${count} user${count === 1 ? "" : "s"} successfully.`);
        setSelectedEmployeeIds({});
        setSelectAllChecked(false);
        console.info("Assign response body:", body);
      } else {
        console.warn("Unexpected response", body);
        alert("Assign completed: " + JSON.stringify(body));
      }
    } catch (err) {
      console.error("Assign error:", err);
      alert("Assign failed: " + String(err));
    } finally {
      setLoadingAssign(false);
    }
  }

  // --- UI ---
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border dark:border-slate-800 p-5 max-w-4xl w-full mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-semibold">Assign Course</div>
            <div className="text-sm text-slate-500">Assign courses to employees quickly</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedEmployeeIds({});
              setSelectAllChecked(false);
              onClose?.();
            }}
            className="px-3 py-1 rounded-md text-sm border hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={assign}
            disabled={loadingAssign || !selectedOrg || !selectedCourse}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50"
          >
            {loadingAssign ? "Assigning…" : "Assign"}
          </button>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: selectors */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-xs text-slate-500">Organisation</label>
            <div className="mt-2">
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="">Select organisation</option>
                {loadingOrgs ? (
                  <option value="">Loading...</option>
                ) : (
                  orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">Course</label>
            <div className="mt-2">
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-800"
              >
                <option value="">Select course</option>
                {loadingCourses ? (
                  <option value="">Loading...</option>
                ) : (
                  courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={createMissingUsers}
                onChange={(e) => setCreateMissingUsers(e.target.checked)}
              />
              <span className="text-sm">Create missing users</span>
            </label>
            <div className="ml-auto text-xs text-slate-400">Optional</div>
          </div>

          {/* Temporary creds summary */}
          {Object.keys(tempCredentialsByUser).length > 0 && (
            <div className="mt-4 p-3 border rounded bg-slate-50 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Temporary credentials</div>
                <div className="text-xs text-slate-500">Copy before closing</div>
              </div>

              <div className="mt-2 space-y-2 text-xs">
                {Object.entries(tempCredentialsByUser).map(([uid, pwd]) => (
                  <div key={uid} className="flex items-center justify-between gap-2 py-1">
                    <div>
                      <div className="font-medium">{uid}</div>
                      <div className="text-xs text-slate-600">Password: {pwd}</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (navigator?.clipboard?.writeText) {
                            await navigator.clipboard.writeText(`${uid}: ${pwd}`);
                            alert("Copied to clipboard");
                          } else {
                            prompt("Copy this temporary credential:", `${uid}: ${pwd}`);
                          }
                        } catch (e) {
                          prompt("Temporary credential:", `${uid}: ${pwd}`);
                        }
                      }}
                      className="px-2 py-1 text-xs rounded border inline-flex items-center gap-2"
                    >
                      <IconCopy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={copyCredentials} className="px-3 py-1 text-sm rounded border">
                  Copy all
                </button>
                <button
                  onClick={() => {
                    setTempCredentialsByUser({});
                  }}
                  className="px-3 py-1 text-sm rounded border"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: employees list */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employees by name or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-md border bg-white dark:bg-slate-800"
              />
            </div>

            <button
              onClick={toggleSelectAll}
              className="px-3 py-2 rounded-md border inline-flex items-center gap-2"
            >
              {selectAllChecked ? (
                <>
                  <IconCheck className="w-4 h-4 text-green-600" /> Unselect all
                </>
              ) : (
                <>
                  <IconUsers className="w-4 h-4" /> Select all
                </>
              )}
            </button>
          </div>

          <div className="border rounded-lg max-h-72 overflow-auto p-2 bg-white dark:bg-slate-900">
            {loadingEmployees ? (
              <div className="p-4 text-sm text-slate-500">Loading employees…</div>
            ) : filteredEmployees().length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No employees found.</div>
            ) : (
              filteredEmployees().map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={!!selectedEmployeeIds[e.id]}
                    onChange={() => toggleEmployee(e.id)}
                    className="h-4 w-4"
                  />

                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                    {e.name ? e.name.charAt(0).toUpperCase() : "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate font-medium">{e.name ?? e.email ?? e.id}</div>
                      <div className="text-xs text-slate-400">{e.email ?? "—"}</div>
                    </div>
                    <div className="text-xs text-slate-400 truncate">ID: {e.id}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-500">
              Selected: {selectedIds().length}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedEmployeeIds({});
                  setSelectAllChecked(false);
                }}
                className="px-3 py-1 rounded border text-sm"
              >
                Clear
              </button>

              <button
                onClick={assign}
                disabled={loadingAssign || !selectedOrg || !selectedCourse}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50 inline-flex items-center gap-2"
              >
                <ClipboardList className="w-4 h-4" /> Assign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
