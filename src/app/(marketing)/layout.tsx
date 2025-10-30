import type { ReactNode } from "react";
import TopNav from "../../components/TopNav";
import Footer from "../../components/Footer";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="w-full">
        <TopNav />
      </header>

      <main className="flex-1 w-full">
        <div className="max-w-full pb-0 px-6 md:px-10 pt-20">
          {children}
        </div>
      </main>

      {/* Use a non-footer wrapper to avoid nested <footer> */}
      <div role="contentinfo" className="w-full mt-10">
        <Footer />
      </div>
    </>
  );
}
