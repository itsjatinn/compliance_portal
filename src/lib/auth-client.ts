// src/lib/auth-client.ts
export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

const KEY = "auth_user";
const EVENT = "auth:changed";

export function setLocalUser(user: User | null) {
  if (user) {
    localStorage.setItem(KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(KEY);
  }
  // dispatch a custom event so other components update immediately
  window.dispatchEvent(new Event(EVENT));
}

export function getLocalUser(): User | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function listenAuthChange(handler: () => void) {
  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) handler();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
