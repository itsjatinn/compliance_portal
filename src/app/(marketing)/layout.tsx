// app/(marketing)/layout.tsx
import type { ReactNode } from "react";
import TopNav from "../../components/TopNav";
import Footer from "../../components/Footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* full-width top nav */}
      <header className="w-full">
        <TopNav />
      </header>

      {/* content container (keeps same centered width as your pages) */}
      <main className="flex-1 w-full">
        <div className="max-w-full pb-0 px-6 md:px-10 pt-20">
          {children}
        </div>
      </main>

      <footer className="w-full mt-10">
        <Footer />
      </footer>
    </>
  );
}
