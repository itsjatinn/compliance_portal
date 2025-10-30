"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Head from "next/head";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  FileText,
  Users,
  BarChart2,
  BookOpen,
  ShieldCheck,
  Bell,
  CheckCircle
} from "lucide-react";

/* ---------------- Testimonials data ---------------- */
const testimonials = [
  {
    name: "Santosh Kumar",
    role: "Head - Student Affairs, IIT Madras",
    quote:
      "POSH training rollout was effortless — records, certificates and audit exports were available in minutes.",
    initials: "SK",
    image: "/testimonials/santosh.jpg"
  },
  {
    name: "Meera Nair",
    role: "HR Lead, BlueBridge",
    quote:
      "Automated reminders and certificate evidence reduced follow-ups by 80% — great for compliance.",
    initials: "MN",
    image: "/testimonials/meera.jpg"
  },
  {
    name: "Rohit Sharma",
    role: "Legal Counsel, PioneerEd",
    quote:
      "The module’s immutable logs and verifiable certificates made our internal audits smooth and defensible.",
    initials: "RS",
    image: "/testimonials/rohit.jpg"
  }
];

/* ---------------- Small helper image component ---------------- */
function ImageWithSmartCrop({
  src,
  alt,
  initials,
  containerClassName = "w-14 h-14",
  imgClassName = ""
}: {
  src?: string;
  alt: string;
  initials: string;
  containerClassName?: string;
  imgClassName?: string;
}) {
  const [errored, setErrored] = useState(false);
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);

  useEffect(() => {
    setErrored(false);
    setDisplaySrc(null);
  }, [src]);

  function handleLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    setDisplaySrc(e.currentTarget.src);
  }

  return (
    <div
      className={`relative overflow-hidden bg-white rounded-full ${containerClassName}`}
      role="img"
      aria-label={alt}
      style={{ flex: "0 0 auto", boxShadow: "0 6px 18px rgba(2,6,23,0.08)" }}
    >
      {!errored && (displaySrc ?? src) ? (
        <img
          src={displaySrc ?? src}
          alt={alt}
          onLoad={handleLoad}
          onError={() => setErrored(true)}
          className={`w-full h-full object-cover ${imgClassName}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-700 font-semibold">
          {initials}
        </div>
      )}
    </div>
  );
}

/* ---------------- Framer Motion variants ---------------- */
const pageContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08
    }
  }
};

const heroVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const floatCard: Variants = {
  initial: { y: 12, rotate: -1 },
  animate: {
    y: [12, 0, 12],
    rotate: [-1, 0, -1],
    transition: { duration: 8, repeat: Infinity, ease: "easeInOut" }
  }
};

const featureList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } }
};

const featureItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
  hover: { y: -6, scale: 1.02, boxShadow: "0 12px 30px rgba(2,6,23,0.12)" }
};

const logoMarquee: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } }
};

const logoItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const testimonialOuter: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } }
};

const testimonialItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.35 } }
};


/* ---------------- Hero (POSH-focused) ---------------- */
function Hero() {
  // video controls / non-skippable logic
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [furthestTime, setFurthestTime] = useState(0); // furthest watched timestamp in seconds
  const [showControls, setShowControls] = useState(true);
  const hideTimeout = useRef<number | null>(null);

  useEffect(() => {
    // attempt autoplay muted on mount
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    // try play, ignore errors
    v.play()
      .then(() => {
        setIsPlaying(true);
        setIsMuted(true);
      })
      .catch(() => {
        // autoplay blocked — leave paused; user can press play
        setIsPlaying(false);
      });

    // cleanup timeout on unmount
    return () => {
      if (hideTimeout.current) {
        window.clearTimeout(hideTimeout.current);
      }
    };
  }, []);

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    // update furthest watched time (small tolerance)
    setFurthestTime((prev) => (t > prev ? t : prev));
  }

  function handleSeeking() {
    const v = videoRef.current;
    if (!v) return;
    // if user tries to seek beyond furthestTime (plus small epsilon), revert them
    const epsilon = 0.25; // allow tiny forward nudges
    if (v.currentTime > furthestTime + epsilon) {
      // revert to furthestTime
      v.currentTime = furthestTime;
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
      setIsPlaying(false);
    }
    showAndHideControls();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
    showAndHideControls();
  }

  // show controls briefly when interacting
  function showAndHideControls() {
    setShowControls(true);
    if (hideTimeout.current) {
      window.clearTimeout(hideTimeout.current);
    }
    hideTimeout.current = window.setTimeout(() => setShowControls(false), 2000);
  }

  return (
    <>
      <Head>
        <title>POSH Training | Mandatory Compliance & Certification</title>
        <meta
          name="description"
          content="Enterprise-grade POSH training: mandatory enrollment, non-skippable video, auto-graded assessments, verifiable certificates and audit-ready reports for HR and legal teams."
        />
        <meta name="keywords" content="POSH training, sexual harassment training, compliance training, HR compliance, certificate" />
        <link rel="canonical" href="https://yourdomain.com/posh-training" />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Course",
              "name": "POSH (Prevention of Sexual Harassment) Training",
              "description": "Mandatory POSH training with non-skippable videos, assessments and verifiable certificates for organizations.",
              "provider": {
                "@type": "Organization",
                "name": "YourCompanyName",
                "sameAs": "https://yourdomain.com"
              }
            })
          }}
        />
      </Head>

      <motion.section
        initial="hidden"
        animate="show"
        variants={pageContainer}
        className="relative overflow-hidden bg-linear-to-b rounded-3xl  from-indigo-950  to-indigo-900 text-white"
      >
        <div className="max-w-7xl  mx-auto   lg:px-20 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div variants={heroVariants}>
              <motion.h1 variants={heroVariants} className="text-4xl  lg:text-5xl font-bold leading-tight tracking-tight">
                POSH Training made secure, verifiable and audit-ready
              </motion.h1>

              <motion.p variants={heroVariants} className="mt-5 text-lg  max-w-xl text-indigo-200">
                Assign mandatory POSH training, enforce non-skippable video viewing, validate assessments and auto-issue verifiable certificates — built for HR & Legal.
              </motion.p>

              <motion.div variants={heroVariants} className="mt-8 flex flex-col sm:flex-row gap-4">
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-md bg-amber-400 text-indigo-900 px-5 py-3 font-semibold shadow-lg hover:opacity-95 focus:outline-none"
                  aria-label="Request POSH demo"
                >
                  Request POSH Demo
                </a>
                <a
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-md border border-amber-200 px-5 py-3 text-amber-100 hover:bg-amber-600/10 focus:outline-none"
                >
                  Start Free Trial
                </a>
              </motion.div>

              <motion.div variants={heroVariants} className="mt-6 text-indigo-200 text-sm">
                <strong>Enterprise features:</strong> mandatory assignments • non-skippable video • audit logs • cert verification
              </motion.div>
            </motion.div>

            <motion.div variants={floatCard} initial="initial" animate="animate" className="relative">
              <motion.div className="bg-white/6 rounded-2xl p-6 lg:p-10 shadow-xl border border-white/10" whileHover={{ scale: 1.01 }}>
                <div className="flex items-center gap-4">
                  <div className="rounded-md bg-amber-50 p-3">
                    <ShieldCheck className="w-6 h-6 text-amber-700" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">POSH Intro - Mandatory </div>
                   
                  </div>
                </div>          

                <div className="mt-5 relative group">
                  <video
                    ref={videoRef}
                    // muted initially to allow autoplay on many browsers
                    muted
                    playsInline
                    crossOrigin="anonymous"
                    // we hide native controls so users can't scrub forward/back
                    controls={false}
                    // ask the browser to preload the resource
                    preload="auto"
                    className="w-full h-55 object-cover bg-black rounded-lg"
                    // handlers to enforce non-skippable behavior
                    onTimeUpdate={handleTimeUpdate}
                    onSeeking={handleSeeking}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onMouseMove={showAndHideControls}
                    loop
                    // set the source directly here (works cross-browser and with CORS)
                    src={
                      "https://pub-f1ac07e3ff5146c28688943a8070f819.r2.dev/videos/POSH%20Act%20Explained%20(2).mp4"
                    }
                  >
                    {/* fallback */}
                    Your browser does not support the video tag.
                  </video>

                  {/* Controls (fade in/out) */}
                  <motion.div
                    animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 16 }}
                    transition={{ duration: 0.24 }}
                    className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
                    onMouseEnter={() => setShowControls(true)}
                    onMouseLeave={() => {
                      // start hide timer when leaving
                      if (hideTimeout.current) window.clearTimeout(hideTimeout.current);
                      hideTimeout.current = window.setTimeout(() => setShowControls(false), 800);
                    }}
                  >
                    <div className="pointer-events-auto flex items-center gap-3 bg-black/20 backdrop-blur-sm px-3 py-2 rounded-full">
                      <button
                        onClick={togglePlay}
                        aria-label={isPlaying ? "Pause preview video" : "Play preview video"}
                        className="rounded-full bg-amber-400 p-3 shadow-lg focus:outline-none"
                      >
                        {isPlaying ? (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <rect x="6" y="5" width="4" height="14" fill="#2b1a07" />
                            <rect x="14" y="5" width="4" height="14" fill="#2b1a07" />
                          </svg>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M7 6v12l10-6L7 6z" fill="#2b1a07" />
                          </svg>
                        )}
                      </button>

                      <button
                        onClick={toggleMute}
                        aria-label={isMuted ? "Unmute video" : "Mute video"}
                        className="rounded-full bg-white/20 p-2 focus:outline-none"
                      >
                        {isMuted ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M5 9v6h4l5 4V5L9 9H5z" fill="#FFD66B" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M5 9v6h4l5 4V5L9 9H5z" fill="#2b1a07" />
                            <path d="M16 8.5v7a3.5 3.5 0 0 0 0-7z" fill="#2b1a07" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="text-xs text-amber-100/90">
                    <div className="font-semibold">Non-skippable video</div>
                    <div className="mt-1">Server-verified progress</div>
                  </div>
                  <div className="text-xs text-amber-100/90">
                    <div className="font-semibold">Assessment</div>
                    <div className="mt-1">Auto-graded MCQs with attempts</div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <a href="/posh/preview" className="text-amber-900 bg-amber-200 px-4 py-2 rounded font-medium text-sm">
                    Preview Module
                  </a>
                  <a href="/posh/faq" className="px-4 py-2 border border-amber-200 rounded text-amber-100 text-sm">
                    POSH FAQ
                  </a>
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-6 -bottom-6 bg-amber-500/8 rounded-lg p-3 text-amber-200 hidden lg:block"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="text-xs">Audit-ready reports</div>
                <div className="font-semibold text-sm">Export CSV • PDF evidence</div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* decorative animated gradients */}
        <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 0.16 }} className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-40 top-8 w-96 h-96 rounded-full bg-amber-400 blur-3xl mix-blend-soft-light opacity-20" />
          <div className="absolute right-0 bottom-12 w-72 h-72 rounded-full bg-indigo-600 blur-2xl mix-blend-overlay opacity-30" />
        </motion.div>
      </motion.section>
    </>
  );
}


/* ---------------- POSH Feature Grid ---------------- */
const FEATURES = [
  {
    title: "Mandatory Assignments",
    desc: "Bulk enroll employees, set due dates and auto-notify learners.",
    Icon: Users
  },
  {
    title: "Non-skippable Video",
    desc: "Signed playback + server heartbeats ensure verifiable watch evidence.",
    Icon: Bell
  },
  {
    title: "Assessments & Attempts",
    desc: "Auto-graded quizzes, configurable passing score, attempt limits.",
    Icon: CheckCircle
  },
  {
    title: "Verifiable Certificates",
    desc: "HTML → PDF certificates with unique serials and verification links.",
    Icon: FileText
  },
  {
    title: "Audit Logs & Exports",
    desc: "Immutable watch logs, timestamps, IPs — exportable for audits.",
    Icon: BarChart2
  },
  {
    title: "Escalation & Reporting",
    desc: "HR dashboards, manager views and escalation workflows.",
    Icon: ShieldCheck
  }
];

function FeatureGrid() {
  return (
    <motion.section id="features" initial="hidden" animate="show" variants={featureList} className="py-14 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-20">
        <motion.h2 variants={heroVariants} className="text-3xl font-semibold text-indigo-900 text-center">POSH training — core capabilities</motion.h2>
        <p className="mt-2 text-center text-slate-600 max-w-2xl mx-auto">Everything you need to stay compliant and produce evidence for audits.</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              variants={featureItem}
              whileHover="hover"
              className="p-5 border rounded-lg bg-amber-50/10 cursor-default"
            >
              <div className="flex items-start gap-4">
                <div className="bg-amber-100 p-2 rounded">
                  <f.Icon className="w-6 h-6 text-amber-700" />
                </div>
                <div>
                  <div className="font-semibold text-indigo-900">{f.title}</div>
                  <div className="text-sm text-slate-600 mt-1">{f.desc}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ---------------- How it Works (3 steps) ---------------- */
const STEPS = [
  { title: "Assign & Notify", desc: "Upload Excel or assign users — automatic invites with set-password links." },
  { title: "Enforce & Verify", desc: "Signed video playback, server heartbeats, and required assessments." },
  { title: "Certify & Archive", desc: "Auto-generate certificates and store immutable logs for audits." }
];

function HowItWorks() {
  return (
    <section id="how" className="py-12 bg-indigo-50">
      <div className="max-w-5xl mx-auto px-6 lg:px-20 text-center">
        <motion.h2 initial="hidden" animate="show" variants={heroVariants} className="text-2xl font-semibold text-indigo-900">How POSH rollout works — in 3 steps</motion.h2>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <motion.article key={i} initial="hidden" animate="show" variants={featureItem} transition={{ delay: i * 0.04 }} className="p-5 rounded-lg bg-white border shadow-sm">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 inline-flex items-center justify-center mb-3 font-semibold">{i+1}</div>
              <h3 className="font-semibold text-indigo-900">{s.title}</h3>
              <p className="text-sm mt-2 text-slate-600">{s.desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Animated Logo Marquee ---------------- */
function ClientsStrip() {
  const brandSvgs = [Aurion, Novexa, PioneerEd, BlueBridge, Triton, Verity];
  const logos = [...brandSvgs, ...brandSvgs];
  const ref = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const pxPerSecond = 24;
    function step(now: number) {
      if (!el) return;
      const dt = now - last;
      last = now;
      if (!paused) {
        el.scrollLeft += (pxPerSecond * dt) / 1000;
        if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft -= el.scrollWidth / 2;
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  return (
    <motion.section initial="hidden" animate="show" variants={logoMarquee} className="py-8 sm:py-10 bg-white w-full">
      <div className="max-w-7xl mx-auto px-6 lg:px-20">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center text-indigo-900">Trusted By</h2>
        <div
          ref={ref}
          className="w-full overflow-x-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="flex gap-8 sm:gap-10 items-center w-max py-3">
            {logos.map((Logo, i) => (
              <motion.div key={i} variants={logoItem} className="flex-shrink-0 w-24 sm:w-32 md:w-40 lg:w-56 flex items-center justify-center">
                <Logo />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ---------- Logo SVGs ---------- */
function Aurion() {
  return (
    <svg viewBox="0 0 120 40" className="w-full h-8 sm:h-10 md:h-12" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aurion">
      <g transform="translate(6,6)">
        <circle cx="12" cy="12" r="10" fill="#6366F1"/>
        <text x="32" y="16" fontFamily="Inter, Arial" fontSize="12" fill="#0F172A">Aurion</text>
      </g>
    </svg>
  );
}
function Novexa() {
  return (
    <svg viewBox="0 0 120 40" className="w-full h-8 sm:h-10 md:h-12" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Novexa">
      <g transform="translate(6,8)">
        <rect x="0" y="0" width="16" height="16" rx="3" fill="#059669"/>
        <text x="34" y="12" fontFamily="Inter, Arial" fontSize="12" fill="#064E3B">Novexa</text>
      </g>
    </svg>
  );
}
function PioneerEd() {
  return (
    <svg viewBox="0 0 140 40" className="w-full h-10 md:h-12" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="PioneerEd">
      <g transform="translate(6,6)">
        <path d="M0 16 L12 4 L24 16 Z" fill="#D97706" />
        <text x="36" y="16" fontFamily="Inter, Arial" fontSize="12" fill="#92400E">PioneerEd</text>
      </g>
    </svg>
  );
}
function BlueBridge() {
  return (
    <svg viewBox="0 0 140 40" className="w-full h-10 md:h-12" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="BlueBridge">
      <g transform="translate(6,6)">
        <circle cx="12" cy="12" r="10" fill="#0284C7"/>
        <rect x="36" y="6" width="60" height="12" rx="3" fill="#0369A1"/>
      </g>
    </svg>
  );
}
function Triton() {
  return (
    <svg viewBox="0 0 140 40" className="w-full h-10 md:h-12" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Triton Labs">
      <g transform="translate(6,6)">
        <path d="M0 20 C10 0, 30 0, 40 20" stroke="#0EA5A4" strokeWidth="3" fill="none"/>
        <text x="52" y="18" fontFamily="Inter, Arial" fontSize="12" fill="#065F46">Triton Labs</text>
      </g>
    </svg>
  );
}
function Verity() {
  return (
    <svg viewBox="0 0 120 40" className="w-full h-8 sm:h-10 md:h-12" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Verity">
      <g transform="translate(6,6)">
        <ellipse cx="12" cy="12" rx="10" ry="6" fill="#64748B"/>
        <text x="36" y="16" fontFamily="Inter, Arial" fontSize="12" fill="#0F172A">Verity</text>
      </g>
    </svg>
  );
}

/* ---------------- Testimonials (animated) ---------------- */
function Testimonials() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % testimonials.length), 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.section initial="hidden" animate="show" variants={testimonialOuter} className="py-12 bg-white">
      <div className="max-w-6xl mx-auto px-6 lg:px-20">
        <h3 className="text-2xl font-semibold text-indigo-900 text-center mb-6">What customers say</h3>

        <div className="relative">
          <AnimatePresence initial={false} mode="wait">
            {testimonials.map((t, idx) =>
              idx === index ? (
                <motion.blockquote
                  key={t.name}
                  variants={testimonialItem}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="border p-6 rounded-lg shadow-md mx-auto max-w-3xl"
                >
                  <div className="flex items-start gap-4">
                    <ImageWithSmartCrop src={t.image} alt={t.name} initials={t.initials} containerClassName="w-16 h-16" />
                    <div>
                      <p className="italic text-slate-800">“{t.quote}”</p>
                      <div className="mt-3 font-semibold text-indigo-900">{t.name}</div>
                      <div className="text-sm text-slate-500">{t.role}</div>
                    </div>
                  </div>
                </motion.blockquote>
              ) : null
            )}
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-center gap-2">
            {testimonials.map((_, i) => (
              <button key={i} onClick={() => setIndex(i)} aria-label={`Show testimonial ${i+1}`}>
                <motion.span
                  className={`block w-3 h-3 rounded-full ${i === index ? "bg-indigo-900" : "bg-slate-300"}`}
                  whileTap={{ scale: 0.9 }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ---------------- CTA & Footer (animated CTA) ---------------- */
function DemoCTA() {
  return (
    <section className=" text-white bg-linear-to-b  from-indigo-950  to-indigo-900 rounded-3xl sm:py-20 py-15 mb-19">
      <div className="max-w-8xl mx-auto px-6 lg:px-21 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl sm:text-3xl font-semibold">
            Ready to deploy POSH training across your organisation?
          </h3>
          <p className="mt-3 text-slate-200">
            Book a short walkthrough — we'll show rollout, reporting and certificate verification.
          </p>
        </div>

        <div className="flex gap-4 mt-6 sm:mt-0">
          <a
            href="/contact"
            className="px-6 py-3 rounded-lg bg-[var(--color-accent-500)] text-[var(--color-primary-900)] font-semibold hover:bg-[var(--color-accent-600)]"
          >
            Request Demo
          </a>
          
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final Page ---------------- */
export default function PoshLandingPage() {
  return (
    <main className="min-h-screen w-full bg-white text-slate-800 antialiased">
      <Hero />
      <FeatureGrid />
      <HowItWorks />
      <ClientsStrip />
      <Testimonials />
      <DemoCTA />

      
    </main>
  );
}
