"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ClipboardList,
  Search as IconSearch,
  Users as IconUsers,
  Check as IconCheck,
  Copy as IconCopy,
  Mail as IconMail,
  User as IconUser,
  Loader2,
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

  // Email preview modal state
  const [emailPreviewFor, setEmailPreviewFor] = useState<Employee | null>(null);

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

        // NORMALIZE the response to an array in common shapes
        const payload = await res.json().catch(() => null);
        let list: Employee[] = [];

        if (Array.isArray(payload)) {
          list = payload;
        } else if (payload && typeof payload === "object") {
          if (Array.isArray((payload as any).employees)) {
            list = (payload as any).employees;
          } else if (Array.isArray((payload as any).data)) {
            list = (payload as any).data;
          } else if (Array.isArray((payload as any).items)) {
            list = (payload as any).items;
          } else {
            console.warn("Unexpected employees payload shape, normalizing to empty array:", payload);
            list = [];
          }
        }

        setEmployees(list || []);
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
  const filteredEmployees = (): Employee[] => {
    // Ensure we always work with an array
    const base: Employee[] = Array.isArray(employees) ? employees : [];

    const q = searchTerm.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) =>
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
      for (const e of visible) if (e.id) map[e.id] = true;
      setSelectedEmployeeIds((prev) => ({ ...prev, ...map }));
    } else {
      const visible = filteredEmployees();
      setSelectedEmployeeIds((prev) => {
        const copy = { ...prev };
        for (const e of visible) if (e.id) delete copy[e.id];
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
        prompt("Temporary credentials (copy manually):", txt);
      }
    } catch (e) {
      console.warn("Failed to copy credentials", e);
      prompt("Temporary credentials (copy manually):", txt);
    }
  };

  // --- Assign handler (kept same as original) ---
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
      for (const e of Array.isArray(employees) ? employees : []) {
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
          console.info("Temporary credentials for new/updated users:\n", creds);
        }

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

  /* ---------------- Email preview helpers ---------------- */

  function makeEmailTemplate(emp: Employee | null) {
    const org = orgs.find((o) => o.id === selectedOrg);
    const course = courses.find((c) => c.id === selectedCourse);
    const name = emp?.name ?? "{{name}}";
    const subject = `You have been assigned: ${course?.title ?? "{{courseTitle}}"}`;
    const loginLink = `{{loginLink}}`; // placeholder: backend can be replaced
    const body = `Hello ${name},

You have been assigned the course "${course?.title ?? "{{courseTitle}}" }" by ${org?.name ?? "{{orgName}}"}.

Please login to your account to start the course:
${loginLink}

If you don't have an account yet, use the following temporary credentials (if provided by admin) or contact your administrator.

Best regards,
${org?.name ?? "Admin"}`;

    return { subject, body };
  }

  const openEmailPreview = (emp: Employee) => {
    setEmailPreviewFor(emp);
  };

  const closeEmailPreview = () => setEmailPreviewFor(null);

  const copyEmailToClipboard = async () => {
    if (!emailPreviewFor) return;
    const { subject, body } = makeEmailTemplate(emailPreviewFor);
    const txt = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(txt);
      alert("Email template copied to clipboard.");
    } catch (e) {
      console.warn("copy failed", e);
      prompt("Email template (copy manually):", txt);
    }
  };

  const openMailClient = () => {
    if (!emailPreviewFor) return;
    const { subject, body } = makeEmailTemplate(emailPreviewFor);
    const to = emailPreviewFor.email ?? "";
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 p-6 max-w-5xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Assign Course</h2>
            <p className="text-sm text-slate-500 mt-1">Quickly assign a course to multiple employees. Preview the notification email before sending.</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600">Orgs: <strong className="ml-1">{orgs.length}</strong></div>
              <div className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600">Courses: <strong className="ml-1">{courses.length}</strong></div>
              <div className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600">Employees: <strong className="ml-1">{employees.length}</strong></div>
            </div>
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
            {loadingAssign ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" /> Assigning…
              </>
            ) : (
              <>
                <ClipboardList className="w-4 h-4" /> Assign
              </>
            )}
          </button>

          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: selectors */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-800 border rounded-lg p-4 shadow-sm">
            <label className="text-xs font-medium text-slate-600">Organisation</label>
            <div className="mt-2">
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900"
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

            <label className="text-xs font-medium text-slate-600 mt-4 block">Course</label>
            <div className="mt-2">
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full rounded-md border px-3 py-2 bg-white dark:bg-slate-900"
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

            {/* <div className="mt-4 flex items-center gap-2">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={createMissingUsers}
                  onChange={(e) => setCreateMissingUsers(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">Create missing users</span>
              </label>
              <div className="ml-auto text-xs text-slate-400">Optional</div>
            </div> */}

            {/* Temporary creds */}
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
                        <div className="font-medium truncate">{uid}</div>
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
                  <button onClick={copyCredentials} className="px-3 py-1 text-sm rounded border">Copy all</button>
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

          
        </aside>

        {/* Right column: employee list */}
        <main className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label="Search employees"
                placeholder="Search employees by name or email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-md border bg-white dark:bg-slate-900"
              />
            </div>

            <button
              onClick={toggleSelectAll}
              className="px-3 py-2 rounded-md border inline-flex items-center gap-2"
              title="Select visible employees"
            >
              {selectAllChecked ? (
                <>
                  <CheckBadge /> Unselect
                </>
              ) : (
                <>
                  <IconUsers className="w-4 h-4" /> Select all
                </>
              )}
            </button>

            <div className="ml-auto flex items-center gap-3">
              <div className="text-sm text-slate-600">Selected</div>
              <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">{selectedIds().length}</div>
            </div>
          </div>

          <div className="border rounded-lg max-h-[42rem] overflow-auto bg-white dark:bg-slate-900 p-3">
            {loadingEmployees ? (
              <div className="p-6 grid gap-3">
                <div className="flex items-center gap-3"><Loader2 className="animate-spin" /> <div>Loading employees…</div></div>
              </div>
            ) : filteredEmployees().length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No employees found. Try selecting another organisation or import employees.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredEmployees().map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:shadow-md transition-shadow border"
                  >
                    <input
                      id={`cb-${e.id}`}
                      type="checkbox"
                      checked={!!selectedEmployeeIds[e.id]}
                      onChange={() => toggleEmployee(e.id)}
                      className="h-4 w-4"
                      aria-label={`Select ${e.name ?? e.email}`}
                    />

                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                      {e.name ? e.name.charAt(0).toUpperCase() : <IconUser className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate">
                          <div className="font-medium">{e.name ?? e.email ?? e.id}</div>
                          <div className="text-xs text-slate-500 truncate">{e.email ?? "No email available"}</div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Email preview button */}
                          <button
                            onClick={() => openEmailPreview(e)}
                            className="px-2 py-1 rounded-md border text-xs inline-flex items-center gap-2"
                            title="Preview email for this employee"
                          >
                            <IconMail className="w-4 h-4" />
                            Preview
                          </button>

                    
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 mt-1">ID: <span className="font-mono">{e.id}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">Selected: <strong>{selectedIds().length}</strong></div>

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
        </main>
      </div>

      {/* Email preview modal */}
      {emailPreviewFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeEmailPreview} />
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-lg shadow-xl border p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">Email preview</h3>
                <div className="text-sm text-slate-500 mt-1">Preview the notification email for <strong>{emailPreviewFor.name ?? emailPreviewFor.email}</strong></div>
              </div>
              <button onClick={closeEmailPreview} className="p-2 rounded-full hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs text-slate-500">Subject</label>
              <div className="mt-1 p-3 rounded border bg-slate-50 text-sm">{makeEmailTemplate(emailPreviewFor).subject}</div>

              <label className="text-xs text-slate-500 mt-3 block">Body</label>
              <textarea
                readOnly
                rows={8}
                value={makeEmailTemplate(emailPreviewFor).body}
                className="mt-1 w-full p-3 rounded border bg-white dark:bg-slate-900 text-sm font-sans"
              />
            </div>

            <div className="mt-4 flex items-center gap-2 justify-end">
              <button onClick={copyEmailToClipboard} className="px-3 py-1 rounded border inline-flex items-center gap-2">
                <IconCopy className="w-4 h-4" /> Copy
              </button>
              <button onClick={openMailClient} className="px-3 py-1 rounded bg-indigo-600 text-white inline-flex items-center gap-2">
                <IconMail className="w-4 h-4" /> Open mail client
              </button>
              <button onClick={closeEmailPreview} className="px-3 py-1 rounded border">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Small helper badge component to keep markup tidy */
function CheckBadge() {
  return (
    <span className="inline-flex items-center gap-2 px-2 py-1 rounded border text-sm">
      <IconCheck className="w-4 h-4 text-green-600" />
      Unselect
    </span>
  );
}
