// src/components/forms/ResetPasswordForm.tsx
import React, { useEffect, useState } from "react";

type ResetPasswordFormProps = {
  token?: string;
};

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      // optionally prefill or verify the token here
      // e.g., set some state or call an API to validate token
      console.log("Reset token provided:", token);
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // send reset request with token and new password
      await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      // handle success (navigate / show toast)
    } catch (err) {
      // handle error
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded border px-3 py-2"
        required
      />

      <input
        type="password"
        placeholder="Confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded border px-3 py-2"
        required
      />

      <button
        type="submit"
        className="w-full rounded bg-indigo-600 text-white px-4 py-2"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
