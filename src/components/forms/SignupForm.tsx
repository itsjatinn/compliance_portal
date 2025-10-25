import React, { useState } from "react";

type Props = {
  onSuccess?: (data?: any) => void;
  onError?: (err?: any) => void;
};

export default function SignupForm({ onSuccess, onError }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password) {
      setError("All fields are required.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = json?.error || "Signup failed";
        setError(msg);
        onError?.(json || { status: resp.status, message: msg });
      } else {
        onSuccess?.(json);
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("Network error");
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <div className="mb-3">
        <label className="block text-sm font-medium">Full name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 p-2 border rounded w-full"
          required
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 p-2 border rounded w-full"
          required
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 p-2 border rounded w-full"
          required
        />
      </div>

      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
      >
        {loading ? "Signing up..." : "Sign up"}
      </button>
    </form>
  );
}
