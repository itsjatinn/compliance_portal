"use client";

import React, { JSX, useEffect, useRef, useState } from "react";
import { Check, Edit, Lock } from "lucide-react";
import { motion, Variants } from "framer-motion";

type UserProfile = {
  id?: string;
  name: string;
  email: string;
  role?: string;
  image?: string | null;
};

export default function ProfilePage(): JSX.Element {
  const [user, setUser] = useState<UserProfile>({
    id: "",
    name: "",
    email: "",
    role: "",
    image: null,
  });

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // ------------------ fetchUser (re-usable, defensive mapping + debug) ------------------
  async function fetchUser() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
      const contentType = res.headers.get("content-type") || "";
      let data: any = null;
      if (contentType.includes("application/json")) {
        data = await res.json().catch(() => null);
      } else {
        const text = await res.text().catch(() => "");
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          // not JSON, ignore
          data = { rawText: text };
        }
      }

      console.debug("[Profile] /api/auth/me response:", { status: res.status, ok: res.ok, data });

      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          const returnTo = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?returnTo=${returnTo}`;
          return;
        }
        throw new Error("Failed to fetch user");
      }

      // defensive name mapping — try several common keys used by backends
      const name =
        (data && (data.name ?? data.fullName ?? data.fullname ?? data.displayName ?? data.display_name)) ?? "";

      setUser({
        id: data?.id ?? data?.userId ?? user.id ?? "",
        name: String(name ?? "").trim(),
        email: data?.email ?? data?.user?.email ?? user.email ?? "",
        role: data?.role ?? data?.user?.role ?? user.role ?? "",
        image: data?.image ?? data?.avatar ?? data?.user?.image ?? null,
      });
    } catch (err) {
      console.error("fetchUser error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await fetchUser();
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      setTimeout(() => {
        nameInputRef.current?.focus();
        // move caret to end
        const el = nameInputRef.current;
        if (el) {
          const val = el.value;
          el.value = "";
          el.value = val;
        }
      }, 50);
    }
  }, [editing]);

  // ------------------ handleSaveProfile (refreshes user; prefers payload.user) ------------------
  const handleSaveProfile = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/auth/me/password", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: user.name }),
      });

      const text = await res.text();
      let payload: any = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { message: text || null };
      }

      console.debug("[Profile] PUT /api/auth/me/password response:", { status: res.status, payload });

      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          const returnTo = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?returnTo=${returnTo}`;
          return;
        }
        const errMsg = payload?.error ?? payload?.message ?? `❌ Update failed (${res.status})`;
        if (process.env.NODE_ENV === "development") {
          console.warn("Profile update failed:", { status: res.status, payload });
        }
        setStatusMsg(errMsg);
        return;
      }

      // If server returned updated user directly, use it; otherwise re-fetch fresh DB
      const updatedFromPayload = payload?.user ?? payload;
      if (updatedFromPayload && typeof updatedFromPayload === "object") {
        const name =
          (updatedFromPayload.name ??
            updatedFromPayload.fullName ??
            updatedFromPayload.fullname ??
            updatedFromPayload.displayName ??
            updatedFromPayload.display_name) ??
          "";
        setUser((prev) => ({
          ...(prev ?? {}),
          id: updatedFromPayload.id ?? prev.id,
          name: String(name).trim(),
          email: updatedFromPayload.email ?? prev.email,
          role: updatedFromPayload.role ?? prev.role,
          image: updatedFromPayload.image ?? prev.image,
        }));
      } else {
        // fallback: re-fetch authoritative user record from server DB
        await fetchUser();
      }

      setEditing(false);
      setStatusMsg("✅ Profile updated successfully!");
    } catch (err: any) {
      console.error("handleSaveProfile unexpected error:", err);
      setStatusMsg(err?.message ?? "Something went wrong while saving profile.");
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // ------------------ handleChangePassword ------------------
  const handleChangePassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New password and confirm password do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/me/password", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { message: text };
      }

      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          const returnTo = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?returnTo=${returnTo}`;
          return;
        }
        setPasswordMessage(json?.error ?? json?.message ?? `Failed to change password (${res.status})`);
        return;
      }

      setPasswordMessage(json?.message ?? "✅ Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMessage(null), 4000);
    } catch (err: any) {
      console.error("handleChangePassword error:", err);
      setPasswordMessage(err?.message ?? "An error occurred while changing password.");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-indigo-200">Loading your profile...</div>;
  }

  // ------------------ animations (typed correctly) ------------------
  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12, scale: 0.99 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial="hidden" animate="show" variants={containerVariants} className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* NAME CARD */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -6, boxShadow: "0 12px 30px rgba(3,7,18,0.18)" }}
            whileTap={{ scale: 0.995 }}
            className="bg-gradient-to-t from-indigo-950 via-indigo-900 to-indigo-800 p-6 rounded-2xl shadow-md border border-indigo-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-800/40 text-indigo-200">
                    <Edit size={18} />
                  </span>
                  Profile
                </h2>
                <p className="text-sm text-indigo-300 mt-1">Update your display name</p>
              </div>
              <div className="text-sm text-indigo-300">{user.role ?? ""}</div>
            </div>

            {/* Display current name prominently */}
            <div className="mb-4">
              <div className="text-xs text-indigo-300">Current name</div>
              <div className="mt-2 text-xl font-medium text-white">{user.name || "Unnamed User"}</div>
              <div className="text-xs text-indigo-400 mt-1">{user.email}</div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveProfile();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-indigo-200 text-sm">Full Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={user.name}
                  disabled={!editing}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  className={`w-full p-3 mt-2 rounded-lg bg-indigo-950 border border-indigo-700 text-white focus:outline-none ${
                    editing ? "focus:ring-2 focus:ring-indigo-200" : "opacity-85 cursor-not-allowed"
                  }`}
                />
              </div>

              <div className="flex gap-3 items-center">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-indigo-900 px-4 py-2 rounded-lg shadow-sm focus:outline-none"
                >
                  {saving ? "Saving..." : (<><Check size={14} /> Save</>)}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditing((s) => !s);
                    setStatusMsg(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-indigo-700 text-indigo-200 bg-transparent hover:bg-white/5"
                >
                  {editing ? "Cancel" : "Edit"}
                </button>

                {statusMsg && <div className="ml-auto text-sm text-indigo-200">{statusMsg}</div>}
              </div>
            </form>
          </motion.div>

          {/* PASSWORD CARD */}
          <motion.div
            variants={cardVariants}
            whileHover={{ y: -6, boxShadow: "0 12px 30px rgba(3,7,18,0.18)" }}
            whileTap={{ scale: 0.995 }}
            className="bg-gradient-to-t from-indigo-950 via-indigo-900 to-indigo-800 p-6 rounded-2xl shadow-md border border-indigo-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-white flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-indigo-800/40 text-indigo-200">
                    <Lock size={18} />
                  </span>
                  Security
                </h2>
                <p className="text-sm text-indigo-300 mt-1">Change your password</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleChangePassword}>
              <div>
                <label className="text-indigo-200 text-sm">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3 mt-2 rounded-lg bg-indigo-950 border border-indigo-700 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-indigo-200 text-sm">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full p-3 mt-2 rounded-lg bg-indigo-950 border border-indigo-700 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-indigo-200 text-sm">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 mt-2 rounded-lg bg-indigo-950 border border-indigo-700 text-white focus:outline-none"
                />
              </div>

              {passwordMessage && <div className="text-sm text-amber-300">{passwordMessage}</div>}

              <div className="flex gap-3 items-center">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-indigo-900 px-4 py-2 rounded-lg shadow-sm focus:outline-none"
                >
                  {changingPassword ? "Saving..." : "Change Password"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordMessage(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-indigo-700 text-indigo-200 bg-transparent hover:bg-white/5"
                >
                  Reset
                </button>

                <div className="ml-auto text-sm text-indigo-300">Tip: Use a strong password</div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
