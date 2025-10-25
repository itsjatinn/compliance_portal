// app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "YourCompany",
  description: "Compliance LMS & animated learning",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-indigo-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
