// components/auth/AuthProvider.tsx
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email?: string;
  role: "owner" | "admin" | "manager" | "hr"  | "user";
};

const defaultUser: User = { id: "local-1", name: "Demo Admin", role: "admin" };

const AuthContext = createContext<{ user: User | null; setUser: (u: User | null) => void }>({
  user: defaultUser,
  setUser: () => {},
});

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    // try load from localStorage for persistence
    try {
      const raw = localStorage.getItem("demo-auth-user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return defaultUser;
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem("demo-auth-user", JSON.stringify(user));
      else localStorage.removeItem("demo-auth-user");
    } catch (e) {}
  }, [user]);

  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  return useContext(AuthContext);
}
