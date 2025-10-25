"use client";

import React, { useEffect, useState } from "react";
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
              user.name ??
              (user.email ? formatNameFromEmail(user.email) : "Admin"),
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

  return (
    <div className="min-h-screen -mt-9 bg-transparent dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="max-w-8xl mx-auto p-6">
        {/* === HEADER === */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl shadow-lg border border-white/10 mb-8"
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
                <h1 className="text-xl font-semibold tracking-tight">
                  Admin Panel
                </h1>
              </div>
            </div>

            <div className="hidden md:flex items-center flex-1 justify-center max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/70" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search courses, users, reports..."
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-400)]/50 transition"
                />
              </div>
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
                  <div className="text-xs text-white/60">
                    {currentUser?.email ?? "—"}
                  </div>
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
                <motion.nav variants={navList} initial="hidden" animate="show" aria-label="Main navigation">
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
