"use client";

import React, { JSX, useEffect, useState } from "react";
import {
  Menu,
  Search as SearchIcon,
  Bell,
  UserCircle,
  FileText,
  Award,
  LogOut,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Certificate from "./components/certificate";
import ProfileComponent from "./components/profile";
import Assignedcourse from "./components/Assignedcourse";

/* ---------- Helpers ---------- */
function formatNameFromEmail(email?: string, fallback = "Learner") {
  if (!email) return fallback;
  const local = email.split("@")[0] || fallback;
  return local
    .split(/[.\-_+]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

/* ---------- Stat Card (kept if you want to use later) ---------- */
function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white/10">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm text-slate-500 dark:text-slate-300">
            {title}
          </div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
          {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
type SidebarId = "my-courses" | "certificates" | "profile";

const LOCAL_USER_KEY = "auth_user";
const AUTH_CHANGED_EVENT = "auth:changed";

function readLocalUser(): { name: string; email: string } | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(LOCAL_USER_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed) return null;
    // support either { user: { ... } } or direct user object
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

export default function EmployeeDashboard(): JSX.Element {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // open My Courses by default
  const [activeSection, setActiveSection] = useState<SidebarId>("my-courses");
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
  } | null>(null);

  const [query, setQuery] = useState("");

  // Fetch logged-in user & hydrate from localStorage and auth events
  useEffect(() => {
    let mounted = true;

    // hydrate immediately from localStorage (so signup/login from other page/tab updates instantly)
    const local = readLocalUser();
    if (local) {
      setCurrentUser(local);
    }

    async function fetchMe(retry = true) {
      try {
        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
        });

        if (res.status === 401 && retry) {
          await new Promise((r) => setTimeout(r, 200));
          return fetchMe(false);
        }

        if (res.status === 401) {
          const returnTo = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?returnTo=${returnTo}`;
          return;
        }

        const data = await res.json().catch(() => ({}));
        // some /api/auth/me implementations return { user }, others return user directly.
        const user = data?.user ?? data;

        if (mounted && user?.email) {
          const resolved = {
            name: user?.name || formatNameFromEmail(user.email),
            email: user.email,
          };
          setCurrentUser(resolved);

          // Persist canonical user to localStorage so other pages update instantly
          try {
            localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
            // notify other listeners (in case some components rely only on event)
            window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
          } catch (e) {
            // ignore storage errors
          }
        }
      } catch (err) {
        console.error("fetchMe error:", err);
      }
    }

    fetchMe();

    // listen for auth changes triggered by signup/login/logout
    const onAuthChanged = () => {
      const latest = readLocalUser();
      setCurrentUser(latest);
    };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    // also respond to storage events for cross-tab sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_USER_KEY) {
        onAuthChanged();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const sidebarItems: { id: SidebarId; label: string; icon: any }[] = [
    { id: "my-courses", label: "My Courses", icon: FileText },
    { id: "certificates", label: "Certificates", icon: Award },
    { id: "profile", label: "Profile", icon: UserCircle },
  ];

  const mainColumnClass = sidebarOpen
    ? "col-span-12 md:col-span-9 lg:col-span-10"
    : "col-span-12";

  // Logout: call server, clear local copy, notify app
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } catch (e) {
      console.warn("logout network error", e);
    } finally {
      try {
        localStorage.removeItem(LOCAL_USER_KEY);
      } catch {}
      setCurrentUser(null);
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      // redirect to login after logout
      // using router.push ensures a client-side navigation
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen -mt-9 bg-transparent  dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="max-w-9xl mx-auto p-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl pr-2 pl-2  pt-2 pb-2 shadow-lg border border-white/10 mb-8"
        >
          <div className="absolute inset-0 bg-gradient-to-b  from-indigo-950 via-indigo-900 to-indigo-800 " />
          <div className="relative z-10 px-8 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-4">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setSidebarOpen((s) => !s)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </motion.button>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-white/10">
                  <div className="w-6 h-6 text-[var(--color-accent-400)] grid place-items-center">
                    LC
                  </div>
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Learner Dashboard</h1>
                  <div className="text-xs text-white/80">
                    Your assigned training
                  </div>
                </div>
              </div>
            </div>

            {/* Search + user info */}
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block max-w-md flex-1">
                <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-white/70" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search courses..."
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.1 }}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
              </motion.button>

              <motion.div
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-3 bg-white/10 rounded-full px-3 py-1 border border-white/20"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--Color-accent-500)] grid place-items-center text-[var(--color-primary-900)] font-semibold">
                  {((currentUser?.name ?? "L").charAt(0) || "L").toUpperCase()}
                </div>
                <div className="hidden sm:block text-sm leading-tight">
                  <div className="font-medium">{currentUser?.name ?? "User"}</div>
                  <div className="text-xs text-white/70">
                    {currentUser?.email ?? ""}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.header>

        {/* Grid layout */}
        <div className="grid grid-cols-12 gap-6 min-w-0">
          {/* Sidebar */}
          {sidebarOpen && (
            <motion.aside
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="col-span-12 md:col-span-3 lg:col-span-2"
            >
              <div className="rounded-3xl p-5 border border-white/10 bg-gradient-to-t  from-indigo-950 via-indigo-900 to-indigo-800 text-white shadow-xl space-y-4">
                <nav>
                  <ul className="space-y-2 text-sm">
                    {sidebarItems.map((it) => {
                      const Icon = it.icon;
                      const active = activeSection === it.id;
                      return (
                        <motion.li
                          key={it.id}
                          onClick={() => {
                            setActiveSection(it.id);
                            setSidebarOpen(true); // auto-close sidebar on select
                          }}
                          className={`flex items-center gap-3 p-2 rounded-md cursor-pointer ${
                            active ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                          whileHover={{ x: 6, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <Icon className="w-5 h-5 text-white/90" />
                          <span className="text-white/90">{it.label}</span>
                        </motion.li>
                      );
                    })}
                    <motion.li
                      className="flex items-center gap-3 p-2 rounded-md mt-4 text-red-300 hover:bg-red-500/10 cursor-pointer"
                      onClick={handleLogout}
                      whileHover={{ x: 6, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <LogOut />
                      <span>Sign out</span>
                    </motion.li>
                  </ul>
                </nav>
              </div>
            </motion.aside>
          )}

          {/* Main Content */}
          <main className={`${mainColumnClass} space-y-6 min-w-0`}>
            {/* Removed the filter UI as requested */}

            <section>
              {activeSection === "my-courses" && <Assignedcourse />}
              {activeSection === "certificates" && <Certificate />}
              {activeSection === "profile" && <ProfileComponent />}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
