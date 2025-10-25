"use client";

import Image from "next/image";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Navigation */}

      {/* Main Content */}
      <main className="flex-1">
        <section className="relative w-full bg-gray-50 py-16">
          <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            
            {/* Text Section */}
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-6">
                About <span className="text-indigo-600">LawCrafters</span>
              </h1>
              <p className="text-lg text-slate-700 mb-4">
                At LawCrafters, we simplify workplace legal and compliance
                management for growing businesses. Our platform helps HR,
                compliance officers, and leadership stay aligned with
                regulations while reducing risks and saving time.
              </p>
              <p className="text-lg text-slate-700 mb-6">
                With a blend of automation and expert guidance, we ensure your
                organization stays compliant, your employees are protected, and
                your processes are future-ready.
              </p>
              <a
                href="/contact"
                className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
              >
                Contact Us
              </a>
            </div>

            {/* Image Section */}
            <div className="relative w-full h-80 md:h-[400px]">
              <Image
               src="/about/5852543.jpg"
               alt="About LawCrafters"
               fill
               className="object-cover rounded-xl shadow-lg"
               />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
    </div>
  );
}
