"use client";

import { useEffect, useRef, useState } from "react";

type SourceType = "document" | "youtube";

type Flashcard = {
  id: string;
  question: string;
  answer: string;
  batch_id: string;
  source_type: SourceType;
  source_title: string;
  review: {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    next_review: string;
    last_reviewed: string;
  } | null;
};

type BatchSummary = {
  batchId: string;
  sourceType: SourceType;
  sourceTitle: string;
  createdAt: string;
  count: number;
};

type Quality = "again" | "hard" | "good" | "easy";
type Mode = "setup" | "study" | "done";

// ---- shared tokens (mirrors landing/login/sidebar/dashboard) ----
const T = {
  bg: "#0c0c0d",
  surface: "#131314",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
  red: "#f87171",
  yellow: "#eab308",
  green: "#4ade80",
};

const QUALITY_CONFIG: { key: Quality; label: string; color: string }[] = [
  { key: "again", label: "Again", color: T.red },
  { key: "hard", label: "Hard", color: T.yellow },
  { key: "good", label: "Good", color: T.text },
  { key: "easy", label: "Easy", color: T.green },
];

function PanelToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

const MOBILE_BREAKPOINT = 768;

export default function FlashcardsLearnPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("setup");
  const [sourceType, setSourceType] = useState<SourceType>("document");
  const [files, setFiles] = useState<File[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [count, setCount] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState<Record<Quality, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    setIsMobile(mql.matches);
    setPanelOpen(!mql.matches);
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      setPanelOpen(!e.matches);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  async function loadBatches() {
    setBatchesLoading(true);
    try {
      const res = await fetch("/api/flashcards-learn");
      const data = await res.json();
      setBatches(data.batches ?? []);
    } catch {
      // silent — history sidebar is non-critical
    } finally {
      setBatchesLoading(false);
    }
  }

  async function handleGenerate() {
    setError(null);

    if (sourceType === "document" && files.length === 0) {
      setError("Kam se kam ek file upload karo.");
      return;
    }
    if (sourceType === "youtube" && !youtubeUrl.trim()) {
      setError("YouTube URL daalo.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("sourceType", sourceType);
      formData.append("count", String(count));
      if (sourceType === "document") {
        files.forEach((f) => formData.append("files", f));
      } else {
        formData.append("youtubeUrl", youtubeUrl.trim());
      }

      const res = await fetch("/api/flashcards-learn", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Generation failed. Try again.");
        return;
      }

      startStudySession(data.flashcards);
      loadBatches();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenBatch(batchId: string) {
    if (isMobile) setPanelOpen(false);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/flashcards-learn?batchId=${batchId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load this set.");
        return;
      }
      startStudySession(data.flashcards);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function startStudySession(loadedCards: Flashcard[]) {
    setCards(loadedCards);
    setQueue([...loadedCards]);
    setCurrentIndex(0);
    setFlipped(false);
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0 });
    setMode("study");
  }

  async function handleReview(quality: Quality) {
    const card = queue[currentIndex];
    if (!card) return;

    setSessionStats((prev) => ({ ...prev, [quality]: prev[quality] + 1 }));

    fetch("/api/flashcards-learn", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flashcardId: card.id, quality }),
    }).catch(() => {});

    let nextQueue = queue;
    if (quality === "again") {
      nextQueue = [...queue];
      const [reQueued] = nextQueue.splice(currentIndex, 1);
      const insertAt = Math.min(nextQueue.length, currentIndex + 3);
      nextQueue.splice(insertAt, 0, reQueued);
      setQueue(nextQueue);
    }

    setFlipped(false);

    if (currentIndex + 1 >= nextQueue.length) {
      setMode("done");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  async function handleDeleteBatch(batchId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch("/api/flashcards-learn", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      setBatches((prev) => prev.filter((b) => b.batchId !== batchId));
    } catch {
      // ignore
    }
  }

  function resetToSetup() {
    if (isMobile) setPanelOpen(false);
    setMode("setup");
    setFiles([]);
    setYoutubeUrl("");
    setCards([]);
    setQueue([]);
    setError(null);
  }

  const styles = {
    page: {
      display: "flex",
      height: "100%",
      background: T.bg,
      color: T.text,
      fontFamily: "'Hanken Grotesk', sans-serif",
    } as React.CSSProperties,
    sidebar: {
      width: "260px",
      borderRight: `1px solid ${T.border}`,
      padding: "24px 16px",
      overflowY: "auto",
      flexShrink: 0,
    } as React.CSSProperties,
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      overflowY: "auto",
    } as React.CSSProperties,
    label: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.62rem",
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: T.textMuted,
    },
    tabBtn: (active: boolean) => ({
      flex: 1,
      padding: "10px 16px",
      border: `1px solid ${active ? T.text : T.border}`,
      background: active ? "rgba(255,255,255,0.06)" : "transparent",
      color: active ? T.text : T.textMuted,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "0.65rem",
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      cursor: "pointer",
      borderRadius: "999px",
      transition: "all 0.2s ease",
    }),
    primaryBtn: {
      padding: "12px 28px",
      border: "none",
      borderRadius: "999px",
      background: T.text,
      color: T.bg,
      fontFamily: "'Hanken Grotesk', sans-serif",
      fontSize: "0.86rem",
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s ease",
    } as React.CSSProperties,
    card: {
      width: "100%",
      maxWidth: "560px",
      minHeight: "260px",
      borderRadius: "18px",
      border: `1px solid ${T.border}`,
      background: T.surface,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px",
      textAlign: "center" as const,
      cursor: "pointer",
      fontSize: "1.1rem",
      lineHeight: 1.6,
    } as React.CSSProperties,
  };

  return (
    <div style={{ ...styles.page, position: "relative" }}>
      {isMobile && panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }}
        />
      )}

      {/* Sidebar — history */}
      <div style={{
        ...styles.sidebar,
        ...(isMobile ? {
          position: "fixed" as const,
          top: 0, bottom: 0, left: 0,
          zIndex: 50,
          background: T.bg,
          transform: panelOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        } : {}),
      }}>
        <h2
          style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "1rem",
            fontWeight: 700,
            marginBottom: "16px",
            color: T.text,
          }}
        >
          Flashcard Sets
        </h2>
        <button
          onClick={resetToSetup}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "16px",
            border: `1px dashed ${T.border}`,
            borderRadius: "10px",
            background: "transparent",
            color: T.textMuted,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.62rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          + New Set
        </button>

        {batchesLoading && (
          <p style={{ ...styles.label, opacity: 0.6 }}>Loading...</p>
        )}
        {!batchesLoading && batches.length === 0 && (
          <p style={{ ...styles.label, opacity: 0.6 }}>No sets yet</p>
        )}

        {batches.map((b) => (
          <div
            key={b.batchId}
            onClick={() => handleOpenBatch(b.batchId)}
            style={{
              padding: "10px 12px",
              marginBottom: "8px",
              border: `1px solid ${T.border}`,
              borderRadius: "10px",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s ease",
            }}
          >
            <p
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: "18px",
                color: T.text,
              }}
            >
              {b.sourceType === "youtube" ? "▶ " : "📄 "}
              {b.sourceTitle}
            </p>
            <p style={{ ...styles.label, marginTop: "4px", fontSize: "0.55rem" }}>
              {b.count} cards
            </p>
            <button
              onClick={(e) => handleDeleteBatch(b.batchId, e)}
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                border: "none",
                background: "none",
                color: T.textMuted,
                cursor: "pointer",
                fontSize: "0.7rem",
              }}
              title="Delete set"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Main panel */}
      <div style={{ ...styles.main, position: "relative", padding: isMobile ? "20px 16px" : styles.main.padding }}>
        {isMobile && (
          <button
            onClick={() => setPanelOpen(true)}
            style={{
              width: "34px", height: "34px", borderRadius: "8px",
              background: T.surface, border: `1px solid ${T.border}`, color: T.text,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              position: "absolute", top: "16px", left: "16px",
            }}
          ><PanelToggleIcon /></button>
        )}
        {mode === "setup" && (
          <div style={{ width: "100%", maxWidth: "480px" }}>
            <h1
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: "1.7rem",
                fontWeight: 700,
                marginBottom: "8px",
                color: T.text,
                letterSpacing: "-0.02em",
              }}
            >
              Generate Flashcards
            </h1>
            <p style={{ ...styles.label, marginBottom: "26px" }}>
              Document upload karo ya YouTube video/live session ka URL do
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
              <button style={styles.tabBtn(sourceType === "document")} onClick={() => setSourceType("document")}>
                Document
              </button>
              <button style={styles.tabBtn(sourceType === "youtube")} onClick={() => setSourceType("youtube")}>
                YouTube URL
              </button>
            </div>

            {sourceType === "document" ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1px dashed ${T.border}`,
                  borderRadius: "14px",
                  padding: "32px",
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: "20px",
                  transition: "border-color 0.2s ease",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.pptx,.xlsx,.txt,.csv"
                  hidden
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
                {files.length === 0 ? (
                  <p style={styles.label}>Click to select files (PDF, DOCX, PPTX, XLSX, TXT, CSV)</p>
                ) : (
                  <p style={{ fontSize: "0.8rem", color: T.text }}>
                    {files.map((f) => f.name).join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or live URL"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  marginBottom: "20px",
                  borderRadius: "10px",
                  border: `1px solid ${T.border}`,
                  background: T.surface,
                  color: T.text,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.75rem",
                }}
              />
            )}

            <div style={{ marginBottom: "26px" }}>
              <label style={{ ...styles.label, display: "block", marginBottom: "10px" }}>
                Number of cards: {count}
              </label>
              <input
                type="range"
                min={5}
                max={30}
                step={5}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ width: "100%", accentColor: T.text }}
              />
            </div>

            {error && (
              <p style={{ color: T.red, fontSize: "0.75rem", marginBottom: "16px" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{ ...styles.primaryBtn, width: "100%", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Generating..." : "Generate Flashcards"}
            </button>
          </div>
        )}

        {mode === "study" && queue[currentIndex] && (
          <div style={{ width: "100%", maxWidth: "560px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <span style={styles.label}>
                Card {currentIndex + 1} / {queue.length}
              </span>
              <span style={styles.label}>{queue[currentIndex].source_title}</span>
            </div>

            <div
              style={{
                height: "3px",
                background: T.border,
                borderRadius: "2px",
                marginBottom: "24px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${((currentIndex + 1) / queue.length) * 100}%`,
                  background: T.text,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div style={styles.card} onClick={() => setFlipped((f) => !f)}>
              <div>
                {!flipped && (
                  <>
                    <p style={{ ...styles.label, marginBottom: "16px" }}>Question</p>
                    <p style={{ color: T.text }}>{queue[currentIndex].question}</p>
                    <p style={{ ...styles.label, marginTop: "24px", opacity: 0.5 }}>
                      Tap to reveal answer
                    </p>
                  </>
                )}
                {flipped && (
                  <>
                    <p style={{ ...styles.label, marginBottom: "16px" }}>
                      Answer
                    </p>
                    <p style={{ color: T.text }}>{queue[currentIndex].answer}</p>
                  </>
                )}
              </div>
            </div>

            {flipped && (
              <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
                {QUALITY_CONFIG.map((q) => (
                  <button
                    key={q.key}
                    onClick={() => handleReview(q.key)}
                    style={{
                      flex: 1,
                      padding: "12px",
                      border: `1px solid ${q.color}`,
                      borderRadius: "10px",
                      background: "transparent",
                      color: q.color,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      transition: "background 0.2s ease",
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "done" && (
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: "1.7rem",
                fontWeight: 700,
                marginBottom: "20px",
                color: T.text,
              }}
            >
              Session Complete
            </h1>
            <div style={{ display: "flex", gap: "20px", marginBottom: "32px", justifyContent: "center" }}>
              {QUALITY_CONFIG.map((q) => (
                <div key={q.key} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: "1.5rem", fontWeight: 700, color: q.color, margin: 0 }}>
                    {sessionStats[q.key]}
                  </p>
                  <p style={{ ...styles.label, marginTop: "4px" }}>{q.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => startStudySession(cards)}
                style={{
                  ...styles.primaryBtn,
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  color: T.text,
                }}
              >
                Study Again
              </button>
              <button onClick={resetToSetup} style={styles.primaryBtn}>
                New Set
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}