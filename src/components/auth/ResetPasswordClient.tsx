// src/components/auth/ResetPasswordClient.tsx
"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import ResetPasswordForm from "../../components/forms/ResetPasswordForm";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  return <ResetPasswordForm token={token} />;
}
