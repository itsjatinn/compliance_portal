// app/(auth)/layout.tsx
import type { ReactNode } from "react";
import Link from "next/link";
import TopNav from "./authnav";
 // adjust path if needed

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen ">
      {/* Top Navigation */}
      <TopNav />

      {/* small top spacer + logo row (optional) */}
      <div className="absolute left-6 top-6">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="h-8 w-8" aria-hidden />
          <span className="sr-only">YourCompany</span>
        </Link>
      </div>

      {/* centered auth container */}
      <main className=" max-w-8xl mx-auto px-6 py-20">
        <div className="">
          {children}
        </div>
      </main>

      
    </div>
  );
}
