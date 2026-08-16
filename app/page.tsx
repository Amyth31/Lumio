"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Scroll-reveal wrapper. Respects prefers-reduced-motion.
// ---------------------------------------------------------------------------
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
      <style jsx>{`
        .reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal-visible {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signature visual, restrained: a document resolving into a handful of
// grayscale chunk-nodes that converge into a single accent-colored answer
// node. One color, used once — everything else is line and gray.
// ---------------------------------------------------------------------------
function SynthesisDiagram() {
  const chunkPositions = [
    { x: 230, y: 70 }, { x: 255, y: 110 }, { x: 215, y: 140 },
    { x: 270, y: 45 }, { x: 300, y: 95 }, { x: 285, y: 150 },
    { x: 320, y: 120 }, { x: 335, y: 65 },
  ];
  const core = { x: 400, y: 105 };

  return (
    <svg viewBox="0 0 480 210" className="sd" role="img" aria-label="A document resolving into an answer">
      <g className="sd-doc">
        <rect x="50" y="45" width="86" height="118" rx="4" fill="none" stroke="rgba(255,255,255,0.16)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x="64" y={64 + i * 15} width={i % 2 === 0 ? 58 : 42} height="3" rx="1.5" fill="rgba(255,255,255,0.14)" />
        ))}
      </g>

      {chunkPositions.map((p, i) => (
        <line key={`d-${i}`} x1="136" y1="104" x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" className="sd-line" style={{ animationDelay: `${i * 70}ms` }} />
      ))}
      {chunkPositions.map((p, i) => (
        <line key={`c-${i}`} x1={p.x} y1={p.y} x2={core.x} y2={core.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" className="sd-line" style={{ animationDelay: `${350 + i * 70}ms` }} />
      ))}
      {chunkPositions.map((p, i) => (
        <circle key={`n-${i}`} cx={p.x} cy={p.y} r="3.5" fill="rgba(255,255,255,0.55)" className="sd-node" style={{ animationDelay: `${i * 90}ms` }} />
      ))}

      <circle cx={core.x} cy={core.y} r="7.5" fill="var(--accent)" className="sd-core" />

      <style jsx>{`
        .sd { width: 100%; max-width: 480px; height: auto; }
        .sd-doc { animation: sdFade 0.7s ease-out both; }
        .sd-line { opacity: 0; animation: sdIn 0.6s ease-out forwards; }
        .sd-node { opacity: 0; transform-origin: center; animation: sdIn 0.5s ease-out forwards; }
        .sd-core { opacity: 0; animation: sdIn 0.5s 1.1s ease-out forwards; }
        @keyframes sdFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sdIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .sd-doc, .sd-line, .sd-node, .sd-core { animation: none !important; opacity: 1; }
        }
      `}</style>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Minimal single-stroke icons, one per feature. No fills, no color —
// consistent with the monochrome-first system.
// ---------------------------------------------------------------------------
function Icon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "chat":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5z" />
        </svg>
      );
    case "notes":
      return (
        <svg {...common}>
          <path d="M6 3h9l5 5v13H6V3z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6M9 17h6" />
        </svg>
      );
    case "quiz":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "cards":
      return (
        <svg {...common}>
          <rect x="4" y="7" width="13" height="14" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="14" height="12" rx="2" />
          <path d="M17 10l4-2.5v9L17 14" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 20V10M12 20V4M20 20v-7" />
          <path d="M2 20h20" />
        </svg>
      );
    default:
      return null;
  }
}

const FEATURES = [
  { icon: "chat", title: "Chat with your notes", body: "A streaming, multi-document chat that remembers the conversation — attach images, paste a screenshot, or just talk." },
  { icon: "notes", title: "Smart Notes", body: "Turn any document into structured notes with formulas and definitions pulled out and explained." },
  { icon: "quiz", title: "Quiz Arena", body: "Exam-style navigation, real timers, and a full review with explanations after every attempt." },
  { icon: "cards", title: "Flashcards, SM-2", body: "Spaced repetition that adapts — cards you struggle with come back sooner, the ones you know fade out." },
  { icon: "video", title: "YouTube & live sessions", body: "Drop in a lecture or live-session link and get back structured, exam-ready notes." },
  { icon: "chart", title: "Analytics", body: "Streaks, topic history, and a real picture of where your study time is going." },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    const t = setTimeout(() => setLoaded(true), 60);
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="page">
      <header className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
        <div className="nav-inner">
          <span className="logo">Lumio</span>
          <nav className="nav-links">
            <a href="#features">Tools</a>
          </nav>
          <a href="/login" className="btn btn-primary btn-sm">
            Start free
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className={`hero-copy ${loaded ? "hero-in" : ""}`}>
            <span className="eyebrow">For students</span>
            <h1>
              Feed it a syllabus.
              <br />
              Get back a tutor.
            </h1>
            <p className="hero-sub">
              Lumio turns your PDFs, slides, and lecture recordings into a chat that remembers your syllabus,
              flashcards that adapt to what you forget, and quizzes built from your own notes.
            </p>
            <div className="hero-cta">
              <a href="/login" className="btn btn-primary">
                Start studying free
                <span className="btn-arrow">→</span>
              </a>
              <a href="#features" className="btn btn-ghost">
                See what's inside
              </a>
            </div>
            <p className="hero-note">4 free sessions a day · no credit card</p>
          </div>
          <div className={`hero-visual ${loaded ? "hero-in" : ""}`}>
            <SynthesisDiagram />
          </div>
        </div>
      </section>

      <section className="credibility">
        <Reveal>
          <p>
            Built by a CS/AI-ML student who got tired of switching between five tabs before every exam.
          </p>
        </Reveal>
      </section>

      <section id="features" className="features">
        <Reveal>
          <span className="eyebrow center">One workspace, six tools</span>
          <h2 className="section-title center">Everything you'd otherwise open six tabs for</h2>
        </Reveal>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="feature-card">
                <div className="feature-icon">
                  <Icon name={f.icon} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <Reveal>
          <h2>Your syllabus is waiting.</h2>
          <a href="/login" className="btn btn-primary btn-lg">
            Start studying free
          </a>
        </Reveal>
      </section>

      <footer className="footer">
        <span>Lumio</span>
        <span className="footer-muted">Built for the Indian student grind.</span>
      </footer>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Hanken+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap");

        :root {
          --bg: #0c0c0d;
          --surface: #131314;
          --border: rgba(255, 255, 255, 0.09);
          --text: #f2f1ed;
          --text-muted: #8a8a86;
          --accent: #3654e0;
        }

        * {
          box-sizing: border-box;
        }
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font-family: "Hanken Grotesk", sans-serif;
        }

        .eyebrow {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-muted);
          display: inline-block;
        }
        .eyebrow.center {
          display: block;
          text-align: center;
          margin-bottom: 12px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          padding: 13px 26px;
          border-radius: 999px;
          font-family: "Hanken Grotesk", sans-serif;
          font-size: 0.86rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease;
          border: 1px solid transparent;
        }
        .btn-primary {
          background: var(--text);
          color: var(--bg);
        }
        .btn-primary:hover {
          opacity: 0.85;
        }
        .btn-arrow {
          display: inline-block;
          transition: transform 0.2s ease;
        }
        .btn-primary:hover .btn-arrow {
          transform: translateX(3px);
        }
        .btn-ghost {
          background: transparent;
          color: var(--text);
          border-color: var(--border);
        }
        .btn-ghost:hover {
          border-color: rgba(255, 255, 255, 0.3);
        }
        .btn-sm {
          padding: 8px 18px;
          font-size: 0.8rem;
        }
        .btn-lg {
          padding: 15px 34px;
          font-size: 0.92rem;
        }

        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 22px 0;
          transition: background 0.3s ease, border-color 0.3s ease, padding 0.3s ease;
          border-bottom: 1px solid transparent;
        }
        .nav-scrolled {
          background: rgba(12, 12, 13, 0.85);
          backdrop-filter: blur(10px);
          border-bottom-color: var(--border);
          padding: 15px 0;
        }
        .nav-inner {
          max-width: 1120px;
          margin: 0 auto;
          padding: 0 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .logo {
          font-family: "Geist", sans-serif;
          font-weight: 700;
          font-size: 1.15rem;
          letter-spacing: -0.02em;
        }
        .nav-links {
          display: flex;
          gap: 32px;
        }
        .nav-links a {
          color: var(--text-muted);
          text-decoration: none;
          font-size: 0.86rem;
          transition: color 0.2s ease;
        }
        .nav-links a:hover {
          color: var(--text);
        }
        @media (max-width: 760px) {
          .nav-links {
            display: none;
          }
        }

        .hero {
          padding: 120px 28px 90px;
        }
        .hero-inner {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 48px;
          align-items: center;
        }
        .hero-copy,
        .hero-visual {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hero-visual {
          transition-delay: 0.15s;
        }
        .hero-in {
          opacity: 1;
          transform: translateY(0);
        }
        .hero-copy h1 {
          font-family: "Geist", sans-serif;
          font-weight: 700;
          font-size: clamp(2.5rem, 4.4vw, 3.5rem);
          line-height: 1.1;
          letter-spacing: -0.025em;
          margin: 20px 0 22px;
        }
        .hero-sub {
          font-size: 1.05rem;
          line-height: 1.65;
          color: var(--text-muted);
          max-width: 460px;
          margin-bottom: 34px;
        }
        .hero-cta {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .hero-note {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.66rem;
          color: var(--text-muted);
        }
        .hero-visual {
          display: flex;
          justify-content: center;
          opacity: 0.9;
        }
        @media (max-width: 900px) {
          .hero-inner {
            grid-template-columns: 1fr;
          }
          .hero-visual {
            order: -1;
          }
        }

        .credibility {
          max-width: 640px;
          margin: 0 auto;
          padding: 0 28px 90px;
          text-align: center;
        }
        .credibility p {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .features {
          max-width: 1120px;
          margin: 0 auto;
          padding: 20px 28px 100px;
          border-top: 1px solid var(--border);
          padding-top: 90px;
        }
        .section-title {
          font-family: "Geist", sans-serif;
          font-weight: 600;
          font-size: clamp(1.5rem, 2.4vw, 1.9rem);
          margin: 6px 0 0;
        }
        .section-title.center {
          text-align: center;
        }
        .features-grid {
          margin-top: 44px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
        }
        .feature-card {
          background: var(--bg);
          padding: 30px 26px;
          transition: background 0.2s ease;
        }
        .feature-card:hover {
          background: var(--surface);
        }
        .feature-icon {
          color: var(--text-muted);
          margin-bottom: 16px;
          transition: color 0.2s ease;
        }
        .feature-card:hover .feature-icon {
          color: var(--accent);
        }
        .feature-card h3 {
          font-family: "Geist", sans-serif;
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 8px;
        }
        .feature-card p {
          font-size: 0.86rem;
          line-height: 1.55;
          color: var(--text-muted);
          margin: 0;
        }
        @media (max-width: 900px) {
          .features-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 560px) {
          .features-grid {
            grid-template-columns: 1fr;
          }
        }

        .final-cta {
          text-align: center;
          padding: 70px 28px 130px;
          border-top: 1px solid var(--border);
        }
        .final-cta h2 {
          font-family: "Geist", sans-serif;
          font-weight: 700;
          font-size: clamp(1.8rem, 3.2vw, 2.4rem);
          margin: 0 0 30px;
        }

        .footer {
          max-width: 1120px;
          margin: 0 auto;
          padding: 28px;
          display: flex;
          justify-content: space-between;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.72rem;
          color: var(--text-muted);
          border-top: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}