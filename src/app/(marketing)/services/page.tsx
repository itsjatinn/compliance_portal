"use client";

import React, { JSX } from "react";
import Head from "next/head";
import { motion, Variants } from "framer-motion";
import {
  Users as UsersIcon,
  FileText as FileTextIcon,
  Play as PlayIcon,
  Award as AwardIcon,
  Clipboard as ClipboardIcon,
  Bell as BellIcon,
  BarChart2 as BarChart2Icon,
} from "lucide-react";

/* ---------- Motion Variants ---------- */
const floatCard: Variants = {
  initial: { y: 12, rotate: -1 },
  animate: {
    y: [12, 0, 12],
    rotate: [-1, 0, -1],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" },
  },
};

const fadeInItem: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

/* ---------- Types ---------- */
type Service = {
  title: string;
  subtitle?: string;
  description?: string;
  bullets?: string[];
  icon?: React.ElementType | null;
  highlight?: boolean;
};

/* ---------- Services Data ---------- */
const servicesFull: Service[] = [
  {
    title: "Learning Management System (LMS)",
    subtitle: "Course catalog, enrollments & reporting",
    icon: UsersIcon,
    description:
      "A modern LMS designed for compliance, onboarding, and continuous learning. Manage role-based courses, track progress, and generate certificates — all from one dashboard.",
    bullets: ["Course catalog & learning paths", "Completion tracking & certificates (PDF)"],
    highlight: true,
  },
  {
    title: "Assessments & Quizzing",
    subtitle: "Auto-graded quizzes & question banks",
    icon: ClipboardIcon,
    description:
      "Build question banks, randomize quizzes, and auto-grade assessments with real-time analytics and retake policies.",
    bullets: [
      "Question banks & randomization",
      "Auto-grading & manual review",
      "Pass/fail & retake settings",
    ],
  },
  {
    title: "Animated Learning Content",
    subtitle: "Motion graphics & microlearning videos",
    icon: PlayIcon,
    description:
      "Engage learners with animated video lessons and scenario-based explainers that simplify complex topics and boost retention.",
    bullets: [
      "Custom animated explainer modules",
      "Microlearning video series",
      "Completion analytics & interactive quizzes",
    ],
  },
  {
    title: "Reports & Learning Analytics",
    subtitle: "Visual dashboards & data exports",
    icon: BarChart2Icon,
    description:
      "Comprehensive reports for compliance, completions, and engagement metrics with exportable CSV/PDF summaries.",
    bullets: [
      "Completion & pass-rate dashboards",
      "Cohort-level reporting",
      "Automated report scheduling",
    ],
  },
  {
    title: "Certificates & Transcripts",
    subtitle: "Branded certificates & verification",
    icon: AwardIcon as unknown as React.ElementType,
    description:
      "Issue verifiable, branded certificates automatically on course completion and maintain learner transcripts.",
    bullets: [
      "Custom certificate templates",
      "Transcript download & verification",
      "Expiry reminders & renewals",
    ],
  },
  {
    title: "Engagement & Notifications",
    subtitle: "Reminders & escalation workflows",
    icon: BellIcon,
    description:
      "Automated notifications and reminders to keep learners on track. Escalate overdue training and track progress easily.",
    bullets: [
      "Email & in-app notifications",
      "Escalation rules",
      "Progress tracking alerts",
    ],
  },
];

/* ---------- UI helper ---------- */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
      {children}
    </span>
  );
}

/* ---------- Page ---------- */
export default function ServicesPage(): JSX.Element {
  return (
    <main className="min-h-screen bg-gray-50 text-slate-900">
      {/* SEO HEAD */}
      <Head>
        <title>Services | Compliance LMS – Animated Learning & Reporting</title>
        <meta
          name="description"
          content="Explore our LMS services: animated learning modules, assessments, certificates, analytics, and compliance tracking. Scalable, secure and audit-ready."
        />
        <meta
          name="keywords"
          content="LMS services, animated learning, compliance training, corporate LMS, eLearning, certificates, learning analytics, training automation"
        />
        <link rel="canonical" href="https://yourdomain.com/services" />
        <meta property="og:title" content="Services | Compliance LMS" />
        <meta
          property="og:description"
          content="Discover services of our LMS: engaging animated learning, assessments, certificates, and compliance analytics."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://yourdomain.com/services" />
        <meta property="og:image" content="https://yourdomain.com/og-services.png" />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Service",
              "serviceType": "Learning Management System (LMS)",
              "provider": {
                "@type": "Organization",
                "name": "YourCompanyName",
                "url": "https://yourdomain.com",
              },
              "description":
                "Compliance-ready Learning Management System with animated learning content, certificates, assessments and analytics.",
              "offers": {
                "@type": "Offer",
                "url": "https://yourdomain.com/plans",
                "priceCurrency": "USD",
                "price": "Contact us",
                "availability": "https://schema.org/InStock",
              },
            }),
          }}
        />
      </Head>

      {/* HERO SECTION */}
      <section
        className="relative overflow-hidden rounded-3xl bg-linear-to-b  from-indigo-950  to-indigo-900 text-white rounded-b-[2.5rem] shadow-2xl"
        aria-label="LMS Services Hero"
      >
        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            {/* Left column */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            >
              <motion.h1 variants={fadeInItem} className="text-4xl lg:text-5xl font-extrabold leading-tight">
                LMS Services built for <br /> compliance, creativity & scale
              </motion.h1>

              <motion.p
                variants={fadeInItem}
                className="mt-5 text-indigo-200 text-lg max-w-xl leading-relaxed"
              >
                Our LMS combines automation, analytics, and animation — helping organizations
                deliver engaging, verifiable learning experiences at scale.
              </motion.p>

              <motion.div variants={fadeInItem} className="mt-8 flex flex-wrap gap-4">
                <a
                  href="/plans"
                  className="inline-flex items-center gap-2 bg-yellow-400 text-indigo-900 font-semibold px-6 py-3 rounded-md shadow hover:brightness-95 transition"
                >
                  Request Demo
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-3 rounded-md hover:bg-white/10 transition"
                >
                  Talk to Our Team
                </a>
              </motion.div>

              <motion.p variants={fadeInItem} className="mt-8 text-sm text-indigo-300">
                <strong>Features:</strong> Role-based assignments • Animated learning • Audit-ready tracking
              </motion.p>
            </motion.div>

            {/* Right column: floating highlight grid */}
            <motion.div
              variants={floatCard}
              initial="initial"
              animate="animate"
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-lg"
              whileHover={{ scale: 1.02 }}
            >
              <motion.ul
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.15 } },
                }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-6"
              >
                {[
                  {
                    icon: UsersIcon,
                    title: "Smart Enrollments",
                    desc: "Auto-assign training by role or department.",
                  },
                  {
                    icon: FileTextIcon,
                    title: "Verifiable Records",
                    desc: "Certificates & audit logs ready for compliance.",
                  },
                  {
                    icon: BarChart2Icon,
                    title: "Insightful Reports",
                    desc: "Track progress and compliance analytics.",
                  },
                  {
                    icon: PlayIcon,
                    title: "Animated Content",
                    desc: "Engage learners through visuals & storytelling.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.li key={item.title} className="flex flex-col gap-2" variants={fadeInItem}>
                      <Icon className="h-6 w-6 text-yellow-300" aria-hidden />
                      <h4 className="font-semibold">{item.title}</h4>
                      <p className="text-sm text-indigo-200">{item.desc}</p>
                    </motion.li>
                  );
                })}
              </motion.ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <motion.section
        id="services"
        className="max-w-7xl mx-auto px-6 py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
      >
        <motion.h2 variants={fadeInItem} className="text-2xl font-bold text-slate-800">
          LMS Services & Capabilities
        </motion.h2>
        <motion.p variants={fadeInItem} className="mt-3 text-slate-600 max-w-2xl">
          Comprehensive features for training delivery, learner engagement, and compliance tracking.
        </motion.p>

        {/* Highlighted card */}
        {servicesFull
          .filter((s) => s.highlight)
          .map((s) => {
            const Icon = s.icon ?? FileTextIcon;
            return (
              <motion.article
                key={s.title}
                variants={fadeInItem}
                className="bg-white mt-8 rounded-2xl p-8 shadow-md flex flex-col lg:flex-row gap-6 ring-1 ring-indigo-50"
              >
                <div className="flex-shrink-0 flex flex-col items-center lg:items-start">
                  <div className="p-4 rounded-lg bg-indigo-100">
                    <Icon className="h-8 w-8 text-indigo-800" aria-hidden />
                  </div>
                  <Pill>Core Module</Pill>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-indigo-800">{s.title}</h3>
                  <p className="text-sm text-slate-500">{s.subtitle}</p>
                  <p className="mt-4 text-slate-600 text-sm">{s.description}</p>
                  <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
                    {s.bullets?.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="mt-1 text-indigo-600">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.article>
            );
          })}

        {/* Remaining services grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicesFull
            .filter((s) => !s.highlight)
            .map((s) => {
              const Icon = s.icon ?? FileTextIcon;
              return (
                <motion.article
                  key={s.title}
                  variants={fadeInItem}
                  className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-indigo-50">
                      <Icon className="h-6 w-6 text-indigo-800" aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-indigo-800">{s.title}</h3>
                      <p className="text-sm text-slate-500">{s.subtitle}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-slate-600 text-sm">{s.description}</p>
                  <ul className="mt-4 text-sm text-slate-600 space-y-1">
                    {s.bullets?.map((b) => (
                      <li key={b} className="flex gap-2 items-start">
                        <span className="mt-1 text-indigo-600">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </motion.article>
              );
            })}
        </div>
      </motion.section>

      {/* CONTACT CTA */}
      <section className="bg-linear-to-b  from-indigo-950  to-indigo-900 text-white rounded-3xl sm:py-15 py-15 mb-19">
        <div className="max-w-7xl mx-auto px-6 lg:px-20 flex flex-col sm:flex-row items-center justify-between gap-8">
          {/* Left text content */}
          <div>
            <h3 className="text-2xl sm:text-3xl font-semibold">
              Ready to transform your learning experience?
            </h3>
            <p className="mt-3 text-indigo-200 max-w-xl">
              Book a short walkthrough — we’ll show you automation, animated content,
              reporting, and certificate verification in action.
            </p>
          </div>

          {/* Right buttons */}
          <div className="flex gap-4 mt-6 sm:mt-0">
            <a
              href="/plans"
              className="px-6 py-3 rounded-lg bg-yellow-400 text-indigo-900 font-semibold hover:brightness-95 transition"
            >
              Request Demo
            </a>
            <a
              href="/contact"
              className="px-6 py-3 rounded-lg border border-yellow-300 text-white hover:bg-white/10 transition"
            >
              Talk to Our Team
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
