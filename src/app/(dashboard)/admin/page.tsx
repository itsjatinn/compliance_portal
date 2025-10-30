"use client";

import React, { useEffect, useRef, useState } from "react";
import OrganizationManager from "./components/OrganizationManager";
import CoursesManager from "./components/CoursesManager";
import AssignCoursePanel from "./components/AssignCoursePanel";
import AdminAnalyticsPage from "./components/AdminAnalyticsPage";
import {
  Menu,
  Search,
  Users,
  BarChart2,
  BookOpen,
  Building2,
  LogOut,
  Scale,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

type MeUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

function formatNameFromEmail(email?: string, fallback = "Admin") {
  if (!email) return fallback;
  const local = email.split("@")[0] || fallback;
  return local
    .split(/[.\-_+]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

/* ----------------- Search result types ----------------- */
type CourseResult = { id: string; title: string; subtitle?: string };
type OrgResult = {
  id: string;
  name: string;
  domain?: string;
  contact?: string;
  email?: string;
  role?: string;
};
type EmployeeResult = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string;
  orgName?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // DEFAULT: show organizations on load (changed from analytics)
  const [activeSection, setActiveSection] = useState<
    "analytics" | "org" | "courses" | "assign"
  >("org");

  const [query, setQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email?: string;
    role?: string;
  } | null>(null);

  // SERVER-ONLY: always fetch canonical user from /api/auth/me (Prisma)
  useEffect(() => {
    let mounted = true;

    async function fetchMe(retry = true) {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        // Allow one quick retry if unauthorized transiently
        if (res.status === 401 && retry) {
          await new Promise((r) => setTimeout(r, 180));
          return fetchMe(false);
        }

        // If the endpoint doesn't return ok, clear currentUser
        if (!res.ok) {
          if (mounted) setCurrentUser(null);
          return;
        }

        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        // Expecting { user: {...} } or null
        const user: MeUser | null = (data && (data.user ?? data)) || null;

        if (mounted && user && (user.email || user.name)) {
          const resolved = {
            name:
              user.name ?? (user.email ? formatNameFromEmail(user.email) : "Admin"),
            email: user.email ?? undefined,
            role: user.role ?? undefined,
          };
          setCurrentUser(resolved);
        } else if (mounted) {
          setCurrentUser(null);
        }
      } catch (err) {
        if (mounted) setCurrentUser(null);
      }
    }

    fetchMe();

    return () => {
      mounted = false;
    };
  }, []);

  // Toggle/activate a section.
  // If the clicked section is already active, go back to org (changed to org)
  function openSection(section: "analytics" | "org" | "courses" | "assign") {
    setActiveSection((prev) => (prev === section ? "org" : section));
  }

  // sign out logic
  async function handleSignOut() {
    try {
      // 1) call server logout endpoint (best effort)
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        // ignore — endpoint may not exist
      }

      // 2) remove common localStorage keys (best-effort cleanup)
      const keysToRemove = [
        "auth_user",
        "user",
        "authUser",
        "sessionUser",
        "auth:user",
        "loggedUser",
        "currentUser",
        "org:notifications",
      ];
      keysToRemove.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });

      // 3) attempt to clear client-visible cookies (non-HttpOnly)
      if (typeof document !== "undefined") {
        const cookies = document.cookie.split(";");
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          // expire cookie on current path and on root path (best-effort)
          document.cookie =
            name +
            "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;";
          document.cookie =
            name +
            "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" +
            (location.hostname || "") +
            ";SameSite=Lax;";
        }
      }

      // 4) redirect to landing page
      router.push("/");
    } catch (err) {
      // fallback redirect
      window.location.href = "/";
    }
  }

  // small motion variants for animated sidebar
  const navList = {
    hidden: { opacity: 0, x: -6 },
    show: { opacity: 1, x: 0, transition: { staggerChildren: 0.06 } },
  };
  const navItem = {
    hidden: { opacity: 0, x: -8 },
    show: { opacity: 1, x: 0 },
  };

  /* ---------------------- Search dropdown logic ---------------------- */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [coursesResults, setCoursesResults] = useState<CourseResult[]>([]);
  const [orgsResults, setOrgsResults] = useState<OrgResult[]>([]);
  const [employeesResults, setEmployeesResults] = useState<EmployeeResult[]>([]);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const lastQueryRef = useRef<string>("");

  useEffect(() => {
    // close dropdown when clicking outside
    function onDocClick(e: MouseEvent) {
      if (!searchRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!searchRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // perform search (debounced)
  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setCoursesResults([]);
      setOrgsResults([]);
      setEmployeesResults([]);
      setSearchLoading(false);
      setSearchOpen(false);
      lastQueryRef.current = "";
      return;
    }

    setSearchLoading(true);
    setSearchOpen(true);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      performSearch(query.trim());
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function performSearch(q: string) {
    lastQueryRef.current = q;
    setSearchLoading(true);

    // endpoints to query — adjust according to your backend
    const base = "/api/admin";
    const endpoints = {
      courses: `${base}/courses?q=${encodeURIComponent(q)}`,
      orgs: `${base}/orgs?q=${encodeURIComponent(q)}`,
      employees: `${base}/employees?q=${encodeURIComponent(q)}`,
    };

    try {
      // fire all requests in parallel
      const [cRes, oRes, eRes] = await Promise.allSettled([
        fetch(endpoints.courses, { credentials: "include" }),
        fetch(endpoints.orgs, { credentials: "include" }),
        fetch(endpoints.employees, { credentials: "include" }),
      ]);

      // Helper to normalize JSON response shapes to arrays (limit N)
      const normalize = async (r: PromiseSettledResult<Response>, limit = 6) => {
        if (r.status !== "fulfilled") return [];
        const res = r.value;
        if (!res.ok) return [];
        let payload: any;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        if (!payload) return [];

        // payload maybe array or object with .data / .items / .courses etc.
        if (Array.isArray(payload)) return payload.slice(0, limit);
        if (Array.isArray(payload.data)) return payload.data.slice(0, limit);
        if (Array.isArray(payload.items)) return payload.items.slice(0, limit);
        // try common keys
        const arrKeys = ["courses", "results", "orgs", "employees", "users"];
        for (const k of arrKeys) {
          if (Array.isArray((payload as any)[k])) return (payload as any)[k].slice(0, limit);
        }
        // fallback: if object map of id->obj
        if (typeof payload === "object") {
          const vals = Object.values(payload).filter((v) => typeof v === "object");
          if (vals.length) return (vals as any[]).slice(0, limit);
        }
        return [];
      };

      // normalize each
      const [cArr, oArr, eArr] = await Promise.all([normalize(cRes), normalize(oRes), normalize(eRes)]);

      // map to our shapes (best-effort)
      const coursesMapped: CourseResult[] = (cArr as any[]).map((c) => ({
        id: c.id ?? c._id ?? c.courseId ?? String(c.id ?? c._id ?? ""),
        title: c.title ?? c.name ?? c.courseTitle ?? JSON.stringify(c).slice(0, 40),
        subtitle: c.shortDescription ?? c.subtitle ?? undefined,
      }));

      const orgsMapped: OrgResult[] = (oArr as any[]).map((o) => ({
        id: o.id ?? o._id ?? o.orgId ?? String(o.id ?? o._id ?? ""),
        name: o.name ?? o.orgName ?? JSON.stringify(o).slice(0, 40),
        domain: o.domain ?? o.website ?? undefined,
        contact: o.contact ?? o.email ?? undefined,
        email: o.contact ?? o.email ?? undefined,
        role: (o.role as string) ?? undefined,
      }));

      const employeesMapped: EmployeeResult[] = (eArr as any[]).map((u) => ({
        id: u.id ?? u._id ?? u.userId ?? String(u.id ?? u._id ?? ""),
        name: u.name ?? u.fullname ?? u.displayName ?? u.email ?? String(u.id ?? ""),
        email: u.email ?? u.contact ?? undefined,
        role: u.role ?? u.position ?? undefined,
        orgName: u.orgName ?? u.organization ?? u.org ?? undefined,
      }));

      // Only update if query hasn't changed meanwhile (avoid race conditions)
      if (lastQueryRef.current === q) {
        setCoursesResults(coursesMapped.slice(0, 6));
        setOrgsResults(orgsMapped.slice(0, 6));
        setEmployeesResults(employeesMapped.slice(0, 6));
        setSearchLoading(false);
        setSearchOpen(true);
      }
    } catch (err) {
      console.warn("Search error", err);
      setSearchLoading(false);
      setSearchOpen(true);
    }
  }

  function navigateTo(type: "course" | "org" | "employee", id: string) {
    // adjust these routes if your app uses different paths
    if (!id) return;
    if (type === "course") router.push(`/admin/courses/${id}`);
    else if (type === "org") router.push(`/admin/orgs/${id}`);
    else if (type === "employee") router.push(`/admin/employees/${id}`);
    // close dropdown
    setSearchOpen(false);
    setQuery("");
  }

  /* ---------------------- End search logic ---------------------- */

  return (
    <div className="min-h-screen -mt-9 bg-transparent dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="max-w-8xl mx-auto p-6">
        {/* === HEADER === */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-visible rounded-3xl shadow-lg border border-white/10 mb-8 z-10"
        >
          <div className="absolute inset-0 bg-gradient-to-l from-[var(--color-primary-900)] via-[var(--color-primary-800)] to-[var(--color-primary-900)]" />
          <div className="relative z-10 px-8 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarOpen((s) => !s)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
              >
                <Menu className="w-5 h-5" />
              </motion.button>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/10">
                  <Scale className="w-6 h-6 text-[var(--color-accent-400)]" />
                </div>
                <h1 className="text-xl font-semibold tracking-tight">Admin Panel</h1>
              </div>
            </div>

            {/* SEARCH: relative container (dropdown positioned absolute) */}
            <div className="relative flex-1 max-w-2xl mx-6" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/70" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => {
                    if (query.trim()) setSearchOpen(true);
                  }}
                  placeholder="Search courses, organisations, employees..."
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-400)]/50 transition"
                />
              </div>

              {/* Dropdown */}
              {searchOpen &&
                (coursesResults.length || orgsResults.length || employeesResults.length || searchLoading) && (
                  <div
                    className="absolute left-0 right-0 mt-2 bg-white text-stone-600 dark:bg-slate-800 border rounded-xl shadow-lg z-[1000] overflow-hidden"
                    style={{ top: "calc(100% + 8px)" }}
                  >
                    <div className="p-3 max-h-[60vh] overflow-auto">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-900">
                          Search results
                        </div>
                        <div className="text-xs text-slate-400">
                          {searchLoading
                            ? "Searching…"
                            : `${coursesResults.length + orgsResults.length + employeesResults.length} result(s)`}
                        </div>
                      </div>

                      {/* Courses */}
                      {coursesResults.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-slate-500 uppercase font-medium mb-1">
                            Courses
                          </div>
                          <div className="">
                            {coursesResults.map((c) => (
                              <button
                                key={`course-${c.id}`}
                                onClick={() => navigateTo("course", c.id)}
                                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-3"
                              >
                                <BookOpen className="w-4 h-4 text-slate-600" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{c.title}</div>
                                  {c.subtitle && (
                                    <div className="text-xs text-slate-500 truncate">{c.subtitle}</div>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400">Course</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Organisations */}
                      {orgsResults.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-slate-500 uppercase font-medium mb-1">
                            Organisations
                          </div>
                          <div className="">
                            {orgsResults.map((o) => (
                              <button
                                key={`org-${o.id}`}
                                onClick={() => navigateTo("org", o.id)}
                                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-3"
                              >
                                <Building2 className="w-4 h-4 text-slate-600" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{o.name}</div>
                                  <div className="text-xs text-slate-500 truncate">
                                    {o.domain ?? o.contact ?? o.email ?? ""}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-400">Org</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Employees */}
                      {employeesResults.length > 0 && (
                        <div className="mb-1">
                          <div className="text-xs text-slate-500 uppercase font-medium mb-1">
                            Employees
                          </div>
                          <div className="">
                            {employeesResults.map((u) => (
                              <button
                                key={`emp-${u.id}`}
                                onClick={() => navigateTo("employee", u.id)}
                                className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-3"
                              >
                                <Users className="w-4 h-4 text-slate-600" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{u.name ?? u.email ?? u.id}</div>
                                  <div className="text-xs text-slate-500 truncate">
                                    {u.email ?? "—"}
                                    {u.orgName ? ` · ${u.orgName}` : ""}
                                    {u.role ? ` · ${u.role}` : ""}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-400">User</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No results */}
                      {!searchLoading &&
                        coursesResults.length === 0 &&
                        orgsResults.length === 0 &&
                        employeesResults.length === 0 && (
                          <div className="text-sm text-slate-500 p-3">No results found for “{query}”</div>
                        )}
                    </div>
                  </div>
                )}
            </div>

            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 bg-white/10 rounded-full px-3 py-1 border border-white/20 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-500)] grid place-items-center text-[var(--color-primary-900)] font-semibold">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="hidden sm:block text-sm leading-tight">
                  <div className="font-medium">{currentUser?.name ?? "Admin"}</div>
                  <div className="text-xs text-white/60">{currentUser?.email ?? "—"}</div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.header>

        {/* === MAIN GRID === */}
        <div className="grid grid-cols-12 gap-6">
          {sidebarOpen && (
            <motion.aside
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="col-span-12 md:col-span-3 lg:col-span-2"
            >
              <div className="rounded-3xl p-5 border border-white/10 bg-gradient-to-b from-[var(--color-primary-900)] to-[var(--color-primary-800)] text-white shadow-xl space-y-4">
                <motion.nav
                  variants={navList}
                  initial="hidden"
                  animate="show"
                  aria-label="Main navigation"
                >
                  <motion.ul className="space-y-2 text-sm" variants={navList}>
                    {/* Organizations - default */}
                    <motion.li
                      variants={navItem}
                      key="org"
                      onClick={() => openSection("org")}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer select-none ${
                        activeSection === "org" ? "bg-white/20" : "hover:bg-white/10"
                      }`}
                    >
                      <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-3">
                        <Building2 /> <span>Organizations</span>
                      </motion.div>
                    </motion.li>

                    {/* Courses */}
                    <motion.li
                      variants={navItem}
                      key="courses"
                      onClick={() => openSection("courses")}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer select-none ${
                        activeSection === "courses" ? "bg-white/20" : "hover:bg-white/10"
                      }`}
                    >
                      <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-3">
                        <BookOpen /> <span>Courses</span>
                      </motion.div>
                    </motion.li>

                    {/* Assign Course */}
                    <motion.li
                      variants={navItem}
                      key="assign"
                      onClick={() => openSection("assign")}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer select-none ${
                        activeSection === "assign" ? "bg-white/20" : "hover:bg-white/10"
                      }`}
                    >
                      <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-3">
                        <Users /> <span>Assign Course</span>
                      </motion.div>
                    </motion.li>

                    {/* Sign out */}
                    <motion.li
                      variants={navItem}
                      key="signout"
                      onClick={handleSignOut}
                      className="flex items-center gap-3 p-2 mt-4 text-red-300 hover:bg-red-500/10 rounded-md cursor-pointer select-none"
                    >
                      <motion.div whileHover={{ x: 6 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-3">
                        <LogOut /> <span>Sign out</span>
                      </motion.div>
                    </motion.li>
                  </motion.ul>
                </motion.nav>
              </div>
            </motion.aside>
          )}

          {/* === DYNAMIC MAIN CONTENT === */}
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className={`col-span-12 ${
              sidebarOpen ? "md:col-span-9 lg:col-span-10" : "md:col-span-12"
            }`}
          >
            {/* Analytics (not in sidebar anymore; only shown if activeSection === "analytics") */}
            {activeSection === "analytics" && (
              <div className="bg-white/60 dark:bg-slate-800/80 rounded-2xl p-6 shadow-sm border border-white/10">
                <AdminAnalyticsPage />
              </div>
            )}

            {/* Organizations */}
            {activeSection === "org" && (
              <div className="bg-white/60 dark:bg-slate-800/80 rounded-2xl p-6 shadow-sm border border-white/10 mt-6">
                <OrganizationManager onClose={() => setActiveSection("org")} />
              </div>
            )}

            {/* Courses */}
            {activeSection === "courses" && (
              <div className="bg-white/60 dark:bg-slate-800/80 rounded-2xl p-6 shadow-sm border border-white/10 mt-6">
                <CoursesManager inline onClose={() => setActiveSection("org")} />
              </div>
            )}

            {/* Assign */}
            {activeSection === "assign" && (
              <div className="bg-white/60 dark:bg-slate-800/80 rounded-2xl p-6 shadow-sm border border-white/10 mt-6">
                <AssignCoursePanel apiBase="/api/admin" onClose={() => setActiveSection("org")} />
              </div>
            )}
          </motion.main>
        </div>
      </div>
    </div>
  );
}
