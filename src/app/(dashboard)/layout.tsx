// app/(auth)/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import TopNav from "../../components/coursenav"; // adjust path if needed

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen relative">
      {/* Top Navigation — ensure it sits above page content */}
      <div className="relative z-40">
        <TopNav />
      </div>

      {/* small top spacer + logo row (optional) */}
      {/* kept as-is but placed in a stacking context below TopNav */}
      

      {/* centered auth container */}
      <main className="max-w-10xl bg-indigo-50  mx-auto px-6 py-20 relative z-20">
        <div className="">{children}</div>
      </main>
    </div>
  );
}
