// app/components/OrganizationManager.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Building2, UploadCloud, PlusCircle, Trash2 } from "lucide-react";
import Papa from "papaparse";

type Org = {
  id: string;
  name: string;
  slug?: string;
  domain?: string;
  contact?: string;
  createdAt?: string;
};
type EmployeeRow = { id?: string; name: string; email: string; role?: string };

export default function OrganizationManager({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState<"list" | "create-org">("list");
  const [showCsvPanel, setShowCsvPanel] = useState(false);

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // create org form state
  const [orgName, setOrgName] = useState("");
  const [orgDomain, setOrgDomain] = useState("");
  const [orgContact, setOrgContact] = useState("");

  // employee manual add state
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empRole, setEmpRole] = useState("");

  // CSV upload state (inline)
  const [csvPreview, setCsvPreview] = useState<EmployeeRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // employees for selected org
  const [employees, setEmployees] = useState<EmployeeRow[] | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // bulk-paste state
  const [bulkText, setBulkText] = useState("");
  const [bulkPreview, setBulkPreview] = useState<EmployeeRow[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  /* ---------------- role normalization helper ---------------- */

  // normalize role strings to valid Prisma Role enum values
  function mapRole(input?: string): "ADMIN" | "ORG_ADMIN" | "LEARNER" {
    if (!input) return "LEARNER";
    const r = input.trim().toLowerCase();

    if (r === "admin" || r === "administrator") return "ADMIN";
    if (r === "org_admin" || r === "orgadmin" || r === "org-admin" || r === "org admin" || r === "org_admin") return "ORG_ADMIN";
    if (r === "learner" || r === "student" || r === "employee" || r === "user") return "LEARNER";

    // Accept exact enum tokens case-insensitive
    if (r === "admin") return "ADMIN";
    if (r === "org_admin" || r === "org-admin" || r === "orgadmin") return "ORG_ADMIN";
    if (r === "learner") return "LEARNER";

    // fallback
    return "LEARNER";
  }

  /* ---------------- network helpers ---------------- */

  async function doJsonPost(url: string, body: any) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function parseBody(res: Response) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return res.json().catch(() => null);
    }
    return res.text().catch(() => "");
  }

  /* ---------------- fetch orgs ---------------- */

  async function fetchOrgs() {
    setLoadingOrgs(true);
    try {
      const res = await fetch("/api/admin/orgs", { cache: "no-store" });
      if (!res.ok) {
        console.warn("Failed to load orgs:", res.status);
        setOrgs([]);
        setSelectedOrg((prev) => (prev ? prev : null));
        return;
      }
      const data = await res.json().catch(() => null);
      if (Array.isArray(data)) {
        const arr = data as Org[];
        setOrgs(arr);
        setSelectedOrg((prev) =>
          prev && arr.some((o) => o.id === prev) ? prev : arr[0]?.id ?? null
        );
      } else if (data && Array.isArray((data as any).orgs)) {
        const arr = (data as any).orgs as Org[];
        setOrgs(arr);
        setSelectedOrg((prev) =>
          prev && arr.some((o) => o.id === prev) ? prev : arr[0]?.id ?? null
        );
      } else {
        setOrgs([]);
        setSelectedOrg(null);
      }
    } catch (e) {
      console.error("fetchOrgs error:", e);
      setOrgs([]);
      setSelectedOrg(null);
    } finally {
      setLoadingOrgs(false);
    }
  }

  useEffect(() => {
    fetchOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- fetch employees for selected org ---------------- */

  async function fetchEmployeesForOrg(orgId: string | null) {
    if (!orgId) {
      setEmployees(null);
      return;
    }
    setLoadingEmployees(true);
    try {
      let res = await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}/employees`, { cache: "no-store" });

      if (res.status === 404) {
        res = await fetch(`/api/admin/employees?orgId=${encodeURIComponent(orgId)}`, { cache: "no-store" });
      }

      if (!res.ok) {
        console.warn("Failed to fetch employees:", res.status);
        setEmployees([]);
        return;
      }

      const data = await parseBody(res);

      // handle different response shapes:
      let rowsData: any[] = [];

      if (Array.isArray(data)) {
        rowsData = data;
      } else if (data && Array.isArray((data as any).employees)) {
        rowsData = (data as any).employees;
      } else if (data && Array.isArray((data as any).data)) {
        rowsData = (data as any).data;
      } else {
        setEmployees([]);
        return;
      }

      const rows: EmployeeRow[] = (rowsData as any[]).map((x) => ({
        id: x.id ?? x._id ?? undefined,
        name: x.name ?? x.fullname ?? "",
        email: x.email ?? "",
        role: x.role ?? x.position ?? "",
      }));
      setEmployees(rows);
    } catch (err) {
      console.error("fetchEmployeesForOrg error:", err);
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }

  useEffect(() => {
    fetchEmployeesForOrg(selectedOrg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  /* ---------------- create org ---------------- */

  async function handleCreateOrg(e?: React.FormEvent) {
    e?.preventDefault();
    const name = orgName.trim();
    const domain = orgDomain.trim();
    const contact = orgContact.trim();

    if (!name) return alert("Organization name is required");
    setLoadingAction(true);
    try {
      const res = await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, contact }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Create org failed:", res.status, txt);
        throw new Error("Create failed");
      }
      const newOrg = (await res.json()) as Org;
      setOrgs((prev) => [newOrg, ...prev.filter((p) => p.id !== newOrg.id)]);
      setOrgName("");
      setOrgDomain("");
      setOrgContact("");
      setStep("list");
      setSelectedOrg(newOrg.id);
    } catch (err) {
      console.error(err);
      alert("Could not create organization");
    } finally {
      setLoadingAction(false);
    }
  }

  /* ---------------- add single employee ---------------- */

  async function handleAddEmployee(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selectedOrg) return alert("Select or create an organization first");
    if (!empName.trim() || !empEmail.trim()) return alert("Name & email are required");
    setLoadingAction(true);

    try {
      const orgEndpoint = `/api/admin/orgs/${encodeURIComponent(selectedOrg)}/employees`;
      const singlePayload = {
        name: empName.trim(),
        email: empEmail.trim(),
        role: mapRole(empRole),
      };
      let res = await doJsonPost(orgEndpoint, singlePayload);

      if (res.status === 404 || res.status === 405) {
        const fallbackEndpoint = `/api/admin/employees`;
        const fallbackPayload = { orgId: selectedOrg, ...singlePayload };
        console.warn(`${orgEndpoint} returned ${res.status} — trying ${fallbackEndpoint}`);
        res = await doJsonPost(fallbackEndpoint, fallbackPayload);
      }

      const body = await parseBody(res);

      if (!res.ok) {
        console.error("Add employee failed:", res.status, body);
        let msg = `Add employee failed (status ${res.status})`;
        if (body && typeof body === "object" && body.error) msg = String(body.error);
        if (typeof body === "string" && body.startsWith("<!DOCTYPE html")) {
          msg = `Server returned HTML error page — check terminal (next dev).`;
        }
        throw new Error(msg);
      }

      const json = body && typeof body === "object" ? body : null;
      alert(`Added ${json?.addedCount ?? (json?.employee ? 1 : 1)} employee(s)`);
      setEmpName("");
      setEmpEmail("");
      setEmpRole("");
      await fetchEmployeesForOrg(selectedOrg);
      await fetchOrgs();
    } catch (err: any) {
      console.error("handleAddEmployee error:", err);
      alert(err?.message || "Could not add employee");
    } finally {
      setLoadingAction(false);
    }
  }

  /* ---------------- delete org ---------------- */

  async function deleteOrg(id: string | null) {
    if (!id) return;
    if (!confirm("Delete this organization? This will remove the organisation and its employees.")) return;
    setLoadingAction(true);

    try {
      const res = await fetch(`/api/admin/orgs/${encodeURIComponent(id)}`, { method: "DELETE" });

      if (!res.ok) {
        let parsed: any = null;
        try {
          parsed = await res.json();
        } catch (e) {
          const txt = await res.text().catch(() => "");
          console.error("Delete org failed (non-json):", res.status, txt);
          alert(`Failed to delete organization (status ${res.status}). See console for details.`);
          return;
        }

        console.error("Delete org failed:", res.status, parsed);
        const serverMessage = parsed?.error ?? JSON.stringify(parsed);
        const assignmentCount = parsed?.assignmentCount ?? 0;

        if (assignmentCount && assignmentCount > 0) {
          alert(
            `Cannot delete organization: ${serverMessage}\n\n` +
              `There are ${assignmentCount} course(s) assigned to this organization. ` +
              `Please reassign or remove those course(s) first (or use the Courses admin to update their organisation).`
          );
        } else {
          alert(`Failed to delete organization: ${serverMessage}`);
        }

        return;
      }

      setOrgs((prev) => prev.filter((o) => o.id !== id));
      setSelectedOrg((prev) => (prev === id ? null : prev));
      setEmployees(null);
      alert("Organization deleted");
    } catch (err) {
      console.error("deleteOrg error:", err);
      alert("Failed to delete organization (network error)");
    } finally {
      setLoadingAction(false);
    }
  }

  /* ---------------- delete employee (calls your existing route /api/admin/employees/:id?orgId=...) ---------------- */

  async function deleteEmployee(emp: EmployeeRow) {
    if (!selectedOrg) return alert("Select organization first");
    if (!confirm(`Delete ${emp.email} from this organization?`)) return;

    setLoadingAction(true);
    try {
      const orgId = selectedOrg;
      let lastErr: any = null;

      async function tryDelete(endpoint: string, opts: RequestInit) {
        console.log("[delete] trying:", endpoint, opts);
        try {
          const r = await fetch(endpoint, opts);
          const status = r.status;
          let body: any = null;
          try {
            const ct = r.headers.get("content-type") || "";
            if (ct.includes("application/json")) body = await r.json();
            else body = await r.text();
          } catch (e) {
            body = `could not parse body: ${String(e)}`;
          }
          console.log("[delete] response:", endpoint, status, body);
          return { ok: r.ok, status, body, res: r };
        } catch (err) {
          console.error("[delete] network error:", endpoint, err);
          return { ok: false, error: err };
        }
      }

      if (emp.id) {
        const epId = `/api/admin/employees/${encodeURIComponent(emp.id)}?orgId=${encodeURIComponent(orgId)}`;
        const rId = await tryDelete(epId, { method: "DELETE" });
        if (rId.ok) {
          alert("Employee deleted");
          await fetchEmployeesForOrg(selectedOrg);
          return;
        } else {
          lastErr = rId;
        }
      }

      {
        const epEmail = `/api/admin/employees?orgId=${encodeURIComponent(orgId)}&email=${encodeURIComponent(emp.email)}`;
        const rEmail = await tryDelete(epEmail, { method: "DELETE" });
        if (rEmail.ok) {
          alert("Employee deleted");
          await fetchEmployeesForOrg(selectedOrg);
          return;
        } else {
          lastErr = rEmail;
        }
      }

      {
        const epPost = `/api/admin/employees/delete`;
        const rPost = await tryDelete(epPost, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId, email: emp.email, id: emp.id ?? undefined }),
        });
        if (rPost.ok) {
          alert("Employee deleted (via POST fallback)");
          await fetchEmployeesForOrg(selectedOrg);
          return;
        } else {
          lastErr = rPost;
        }
      }

      console.error("deleteEmployee failed attempts:", lastErr);
      let msg = "Failed to delete employee. See console for details.";
      if (lastErr) {
        if (lastErr.error) msg = `Network error: ${String(lastErr.error)}`;
        else msg = `Failed (status ${lastErr.status}): ${JSON.stringify(lastErr.body)}`;
      }
      alert(msg);
    } catch (err) {
      console.error("deleteEmployee error:", err);
      alert("Delete failed (network error)");
    } finally {
      setLoadingAction(false);
    }
  }

  /* ---------------- CSV parse & bulk import (inline) ---------------- */

  function openFilePicker() {
    fileRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    parseCSV(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  function parseCSV(file: File) {
    setCsvPreview([]);
    setCsvErrors([]);
    Papa.parse<EmployeeRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => (h || "").trim().toLowerCase(),
      complete: (results) => {
        const data = results.data || [];
        const errors: string[] = [];
        const rows: EmployeeRow[] = [];
        (data as any[]).forEach((r, i) => {
          const name = (r.name || r.fullname || "").trim();
          const email = (r.email || "").trim();
          const roleInput = (r.role || "").trim();
          if (!name || !email) {
            errors.push(`Row ${i + 2}: missing name or email`);
          } else if (!/^\S+@\S+\.\S+$/.test(email)) {
            errors.push(`Row ${i + 2}: invalid email (${email})`);
          } else {
            rows.push({ name, email, role: roleInput });
          }
        });
        setCsvPreview(rows);
        setCsvErrors(errors);
      },
      error: (err) => {
        setCsvErrors([err.message || "Failed to parse CSV"]);
      },
    });
  }

  async function handleConfirmBulk() {
    if (!selectedOrg) return alert("Select an organization before importing");
    if (csvErrors.length) return alert("Fix CSV errors before importing");
    if (!csvPreview.length) return alert("No valid rows to import");
    setLoadingAction(true);

    try {
      const orgEndpoint = `/api/admin/orgs/${encodeURIComponent(selectedOrg)}/employees`;
      const globalEndpoint = `/api/admin/employees`;

      let useGlobal = false;
      const testRow = csvPreview[0];
      let testRes = await doJsonPost(orgEndpoint, { name: testRow.name, email: testRow.email, role: mapRole(testRow.role) });

      if (testRes.status === 404 || testRes.status === 405) {
        console.warn(`${orgEndpoint} returned ${testRes.status} on test — will use global endpoint per-row`);
        useGlobal = true;
      } else if (!testRes.ok) {
        const testBody = await parseBody(testRes);
        if (testRes.status === 400) {
          useGlobal = true;
          console.warn("Org endpoint test returned 400; switching to per-row global endpoint");
        } else {
          console.warn("Org endpoint test unexpected response:", testRes.status, testBody);
          useGlobal = true;
        }
      }

      const startIndex = testRes.ok && !useGlobal ? 1 : 0;

      for (let i = startIndex; i < csvPreview.length; i++) {
        const r = csvPreview[i];
        const payload = useGlobal
          ? { orgId: selectedOrg, name: r.name, email: r.email, role: mapRole(r.role) }
          : { name: r.name, email: r.email, role: mapRole(r.role) };

        const endpoint = useGlobal ? globalEndpoint : orgEndpoint;
        const rres = await doJsonPost(endpoint, payload);

        if (!rres.ok) {
          const body = await parseBody(rres);
          console.error("Individual import failed for", r, rres.status, body);
          let msg = `Failed to import ${r.email}: status ${rres.status}`;
          if (body && typeof body === "object" && body.error) msg = String(body.error);
          throw new Error(msg);
        }
      }

      alert(`Imported ${csvPreview.length} employees`);
      setCsvPreview([]);
      setCsvErrors([]);
      setShowCsvPanel(false);
      await fetchEmployeesForOrg(selectedOrg);
      await fetchOrgs();
    } catch (err: any) {
      console.error("handleConfirmBulk error:", err);
      alert(err?.message || "Failed to import employees");
    } finally {
      setLoadingAction(false);
    }
  }

  /* ---------------- bulk-paste parsing & import ---------------- */

  function parseBulkText(text: string) {
    setBulkPreview([]);
    setBulkErrors([]);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rows: EmployeeRow[] = [];
    const errors: string[] = [];
    lines.forEach((line, idx) => {
      const parts = line.split(",").map((p) => p.trim());
      const name = parts[0] ?? "";
      const email = parts[1] ?? "";
      const role = parts.slice(2).join(",") ?? "";
      if (!name || !email) {
        errors.push(`Line ${idx + 1}: missing name or email`);
      } else if (!/^\S+@\S+\.\S+$/.test(email)) {
        errors.push(`Line ${idx + 1}: invalid email (${email})`);
      } else {
        rows.push({ name, email, role });
      }
    });
    setBulkPreview(rows);
    setBulkErrors(errors);
  }

  async function handleBulkPasteImport() {
    if (!selectedOrg) return alert("Select an organization first");
    if (bulkErrors.length) return alert("Fix paste errors before importing");
    if (!bulkPreview.length) return alert("No valid rows to import");
    setLoadingAction(true);

    try {
      const orgEndpoint = `/api/admin/orgs/${encodeURIComponent(selectedOrg)}/employees`;
      const globalEndpoint = `/api/admin/employees`;

      let useGlobal = false;
      const testRow = bulkPreview[0];
      let testRes = await doJsonPost(orgEndpoint, { name: testRow.name, email: testRow.email, role: mapRole(testRow.role) });

      if (testRes.status === 404 || testRes.status === 405) {
        useGlobal = true;
      } else if (!testRes.ok) {
        const b = await parseBody(testRes);
        if (testRes.status === 400) {
          useGlobal = true;
        } else {
          useGlobal = true;
          console.warn("Org endpoint test unexpected response:", testRes.status, b);
        }
      }

      const startIndex = testRes.ok && !useGlobal ? 1 : 0;

      for (let i = startIndex; i < bulkPreview.length; i++) {
        const r = bulkPreview[i];
        const payload = useGlobal
          ? { orgId: selectedOrg, name: r.name, email: r.email, role: mapRole(r.role) }
          : { name: r.name, email: r.email, role: mapRole(r.role) };

        const endpoint = useGlobal ? globalEndpoint : orgEndpoint;
        const rres = await doJsonPost(endpoint, payload);

        if (!rres.ok) {
          const body = await parseBody(rres);
          console.error("Bulk-paste import failed for", r, rres.status, body);
          let msg = `Failed to import ${r.email}: status ${rres.status}`;
          if (body && typeof body === "object" && body.error) msg = String(body.error);
          throw new Error(msg);
        }
      }

      alert(`Imported ${bulkPreview.length} employees`);
      setBulkText("");
      setBulkPreview([]);
      setBulkErrors([]);
      await fetchEmployeesForOrg(selectedOrg);
      await fetchOrgs();
    } catch (err: any) {
      console.error("handleBulkPasteImport error:", err);
      alert(err?.message || "Failed to import employees");
    } finally {
      setLoadingAction(false);
    }
  }

  /* ---------------- UI (single-column full-width right panel + dropdown) ---------------- */

  return (
    <div className="p-6 bg-slate-50 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-indigo-600" />
          <div>
            <div className="text-lg font-semibold">Organizations</div>
            <div className="text-xs text-slate-400">Manage orgs & employees</div>
          </div>
        </div>
      </div>

      <div>
        {step === "list" && (
          <div className="grid grid-cols-1 gap-6">
            {/* NOTE: Left column visually removed; replaced by a compact dropdown above the main panel */}
            <div className="col-span-1">
              {/* Right panel (now full-width) */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-semibold">Selected organization</div>
                  <div className="text-xs text-slate-400">Actions</div>
                </div>

                {/* DROPDOWN: used to select organization (replaces left card) */}
                <div className="mb-4">
                  <label className="text-xs text-slate-500 block mb-1">Organization</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedOrg ?? ""}
                      onChange={(e) => setSelectedOrg(e.target.value || null)}
                      className="rounded-md border px-3 py-2"
                    >
                      <option value="">Select organization</option>
                      {orgs.map((o) => {
                        const countText = o.id === selectedOrg ? String(employees?.length ?? 0) : "-";
                        return (
                          <option key={o.id} value={o.id}>
                            {o.name} ({countText})
                          </option>
                        );
                      })}
                    </select>

                    <button
                      onClick={() => setStep("create-org")}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white"
                    >
                      <PlusCircle /> Create
                    </button>

                    <div className="ml-auto text-sm text-slate-400">
                      {loadingOrgs ? "Loading orgs..." : `${orgs.length} org(s)`}
                    </div>
                  </div>
                </div>

                {!selectedOrg && <div className="text-sm text-slate-500">Select an organization to manage employees or import users.</div>}

                {selectedOrg && (
                  <div>
                    <div className="text-sm text-slate-600 mb-3">
                      Manage employees for <span className="font-medium">{orgs.find((x) => x.id === selectedOrg)?.name}</span>
                    </div>

                    {/* single add */}
                    <form className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end" onSubmit={handleAddEmployee}>
                      <div>
                        <label className="text-xs text-slate-500">Full name</label>
                        <input
                          ref={firstInputRef}
                          value={empName}
                          onChange={(e) => setEmpName(e.target.value)}
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          placeholder="e.g. John Doe"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Email</label>
                        <input
                          value={empEmail}
                          onChange={(e) => setEmpEmail(e.target.value)}
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          placeholder="john@example.com"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Role</label>
                        <input
                          value={empRole}
                          onChange={(e) => setEmpRole(e.target.value)}
                          className="mt-1 w-full rounded-md border px-3 py-2"
                          placeholder="e.g. learner"
                        />
                      </div>

                      <div className="sm:col-span-3 flex gap-2 mt-2">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white"
                          disabled={loadingAction}
                        >
                          {loadingAction ? "Adding..." : "Add employee"}
                        </button>
                        <button type="button" onClick={() => deleteOrg(selectedOrg)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-red-600">
                          Delete org
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowCsvPanel((s) => !s)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border ml-auto"
                        >
                          <UploadCloud />
                          {showCsvPanel ? "Hide CSV / Bulk" : "Upload CSV / Bulk"}
                        </button>
                      </div>
                    </form>

                    {/* employees list */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">Employees</div>
                        <div className="text-xs text-slate-400">{loadingEmployees ? "Loading..." : `${employees?.length ?? 0} total`}</div>
                      </div>

                      {loadingEmployees && <div className="text-sm text-slate-500">Loading employees...</div>}

                      {!loadingEmployees && employees && employees.length === 0 && <div className="text-sm text-slate-500">No employees found for this org.</div>}

                      {!loadingEmployees && employees && employees.length > 0 && (
                        <div className="overflow-auto max-h-64 border rounded">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="p-2 text-left">#</th>
                                <th className="p-2 text-left">Name</th>
                                <th className="p-2 text-left">Email</th>
                                <th className="p-2 text-left">Role</th>
                                <th className="p-2 text-left">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {employees.map((emp, idx) => (
                                <tr key={emp.email + idx} className="border-t">
                                  <td className="p-2">{idx + 1}</td>
                                  <td className="p-2">{emp.name}</td>
                                  <td className="p-2">{emp.email}</td>
                                  <td className="p-2">{emp.role}</td>
                                  <td className="p-2">
                                    <button
                                      onClick={() => deleteEmployee(emp)}
                                      className="inline-flex items-center gap-2 px-3 py-1 rounded text-red-600 border"
                                      disabled={loadingAction}
                                    >
                                      <Trash2 size={14} />
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Inline CSV + Bulk area (shown when showCsvPanel=true) */}
                    {showCsvPanel && (
                      <div className="mt-6 bg-slate-50 p-4 rounded">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-medium">CSV Upload</div>
                            <div className="text-xs text-slate-400">Header: <code>name,email,role</code> (role optional)</div>
                          </div>
                          <div>
                            <select value={selectedOrg ?? ""} onChange={(e) => setSelectedOrg(e.target.value || null)} className="rounded-md border px-3 py-2">
                              <option value="">Select organization</option>
                              {orgs.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                          <button onClick={openFilePicker} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 text-white">
                            <UploadCloud /> Select CSV
                          </button>
                          <button
                            onClick={() => {
                              setCsvPreview([]);
                              setCsvErrors([]);
                              if (fileRef.current) fileRef.current.value = "";
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border"
                          >
                            Clear
                          </button>
                          <div className="ml-auto text-sm text-slate-400">
                            Sample CSV: <strong>name,email,role</strong>
                          </div>
                        </div>

                        {csvErrors.length > 0 && <div className="mt-3 text-sm text-red-600">{csvErrors.join(", ")}</div>}

                        {csvPreview.length > 0 && (
                          <div className="mt-3">
                            <div className="text-sm mb-2">Preview ({csvPreview.length})</div>
                            <table className="w-full text-sm border">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="p-2">#</th>
                                  <th className="p-2">Name</th>
                                  <th className="p-2">Email</th>
                                  <th className="p-2">Role</th>
                                </tr>
                              </thead>
                              <tbody>
                                {csvPreview.map((r, i) => (
                                  <tr key={i}>
                                    <td className="p-2">{i + 1}</td>
                                    <td className="p-2">{r.name}</td>
                                    <td className="p-2">{r.email}</td>
                                    <td className="p-2">{r.role}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div className="mt-3 flex gap-2">
                              <button onClick={handleConfirmBulk} className="px-3 py-2 bg-emerald-600 text-white rounded" disabled={loadingAction}>
                                Import {csvPreview.length} users
                              </button>
                              <button
                                onClick={() => {
                                  setCsvPreview([]);
                                  setCsvErrors([]);
                                  if (fileRef.current) fileRef.current.value = "";
                                }}
                                className="px-3 py-2 border rounded"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Divider */}
                        <div className="my-4 border-t" />

                        {/* Bulk paste */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">Bulk add (paste)</div>
                            <div className="text-xs text-slate-400">one per line: <code>name,email,role</code></div>
                          </div>

                          <textarea
                            value={bulkText}
                            onChange={(e) => {
                              setBulkText(e.target.value);
                              parseBulkText(e.target.value);
                            }}
                            placeholder={"Example:\nJohn Doe,john@example.com,learner\nJane Doe,jane@example.com"}
                            className="w-full rounded-md border p-2 min-h-[90px]"
                          />

                          {bulkErrors.length > 0 && <div className="text-sm text-red-600 mt-2">{bulkErrors.join(", ")}</div>}

                          {bulkPreview.length > 0 && (
                            <div className="mt-2">
                              <div className="text-sm mb-1">Preview ({bulkPreview.length})</div>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                {bulkPreview.slice(0, 20).map((r, i) => (
                                  <div key={i} className="p-2 border rounded text-xs">
                                    <div className="font-medium truncate">{r.name}</div>
                                    <div className="truncate">{r.email}</div>
                                    <div className="text-slate-500">{r.role}</div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 flex gap-2">
                                <button onClick={handleBulkPasteImport} className="px-3 py-2 bg-emerald-600 text-white rounded" disabled={loadingAction}>
                                  Import {bulkPreview.length} users
                                </button>
                                <button
                                  onClick={() => {
                                    setBulkText("");
                                    setBulkPreview([]);
                                    setBulkErrors([]);
                                  }}
                                  className="px-3 py-2 border rounded"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* end inline CSV */}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CREATE ORG */}
        {step === "create-org" && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-4 shadow-sm border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-semibold">Create organization</div>
                  <div className="text-xs text-slate-400">Add a new organization</div>
                </div>
                <div>
                  <button onClick={() => setStep("list")} className="p-2 rounded-md border">
                    <X />
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateOrg} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Name</label>
                  <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Domain (optional)</label>
                  <input value={orgDomain} onChange={(e) => setOrgDomain(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="acme.com" />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Contact email</label>
                  <input value={orgContact} onChange={(e) => setOrgContact(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" placeholder="admin@acme.com" />
                </div>

                <div className="sm:col-span-3 flex gap-2 mt-2">
                  <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white">
                    {loadingAction ? "Creating..." : "Create"}
                  </button>
                  <button type="button" onClick={() => setStep("list")} className="inline-flex items-center gap-2 px-4 py-2 rounded-md border">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
