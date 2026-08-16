"use client";

import { useState, useEffect, useRef } from "react";

type Question = {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  difficulty: string;
};

type QuizState = "setup" | "quiz" | "results";
type TimerOption = { label: string; seconds: number };

const TIMER_OPTIONS: TimerOption[] = [
  { label: "30s", seconds: 30 },
  { label: "1 min", seconds: 60 },
  { label: "2 min", seconds: 120 },
  { label: "3 min", seconds: 180 },
];

// ---- shared tokens (mirrors landing/login/sidebar/dashboard/flashcards/notes) ----
const T = {
  bg: "#0c0c0d",
  surface: "#131314",
  surfaceHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
  red: "#f87171",
  redBg: "rgba(248,113,113,0.08)",
  green: "#4ade80",
  greenBg: "rgba(74,222,128,0.08)",
  yellow: "#eab308",
};

export default function QuizArenaPage() {
  const [state, setState] = useState<QuizState>("setup");
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState(10);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timesUp, setTimesUp] = useState<boolean[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (state === "quiz" && timerEnabled && !submitted) {
      clearInterval(timerRef.current);
      setTimeLeft(timerSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setTimesUp((t) => {
              const next = [...t];
              next[currentQ] = true;
              return next;
            });
            if (currentQ + 1 < questions.length) {
              setTimeout(() => setCurrentQ((q) => q + 1), 600);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [currentQ, state, submitted, timerEnabled]);

  async function startQuiz() {
    if (!uploadedFiles.length) { setError("Upload at least one document."); return; }
    setLoading(true);
    setError(null);

    const formData = new FormData();
    uploadedFiles.forEach((f) => formData.append("files", f));
    formData.append("difficulty", difficulty);
    formData.append("count", String(count));

    const res = await fetch("/api/quiz-session", { method: "POST", body: formData });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) { setError(data.error ?? "Failed to generate quiz."); return; }

    setQuestions(data.questions);
    setAttemptId(data.attemptId);
    setAnswers(new Array(data.questions.length).fill(null));
    setTimesUp(new Array(data.questions.length).fill(false));
    setCurrentQ(0);
    setSubmitted(false);
    setStartTime(Date.now());
    setState("quiz");
  }

  function selectAnswer(letter: string) {
    if (submitted || timesUp[currentQ]) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = letter;
    setAnswers(newAnswers);
  }

  async function submitQuiz() {
    clearInterval(timerRef.current);
    const score = answers.filter((a, i) => a === questions[i]?.correct).length;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    if (attemptId) {
      await fetch("/api/quiz-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, score, time_taken: timeTaken }),
      });
    }
    setSubmitted(true);
    setState("results");
  }

  function exitQuiz() {
    clearInterval(timerRef.current);
    setState("setup");
    setQuestions([]);
    setAnswers([]);
    setSubmitted(false);
    setCurrentQ(0);
    setTimesUp([]);
  }

  const currentQuestion = questions[currentQ];
  const answeredCount = answers.filter((a) => a !== null).length;

  // ─── SETUP ───────────────────────────────────────────────
  if (state === "setup") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "40px",
        overflowY: "auto",
        background: T.bg,
      }}>
        <div style={{ width: "100%", maxWidth: "520px" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textMuted,
            marginBottom: "8px",
          }}>Learn</div>
          <h1 style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "2rem",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: T.text,
            marginBottom: "4px",
          }}>Quiz Arena</h1>
          <p style={{
            fontFamily: "'Hanken Grotesk', sans-serif",
            fontSize: "0.9rem",
            color: T.textMuted,
            marginBottom: "28px",
          }}>Upload documents and test your knowledge.</p>

          {error && (
            <div style={{
              padding: "10px 14px",
              background: T.redBg,
              border: "1px solid rgba(248,113,113,0.25)",
              borderRadius: "8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.68rem",
              color: T.red,
              marginBottom: "16px",
            }}>{error}</div>
          )}

          {/* File upload */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.62rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.textMuted,
              display: "block",
              marginBottom: "8px",
            }}>Upload Documents</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const files = Array.from(e.dataTransfer.files);
                setUploadedFiles((prev) => [...prev, ...files]);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1px dashed ${dragOver ? T.text : T.border}`,
                borderRadius: "12px",
                padding: "20px 16px",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? T.surfaceHover : T.surface,
                transition: "all 0.2s ease",
                marginBottom: uploadedFiles.length ? "10px" : "0",
              }}
            >
              <p style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontSize: "0.88rem",
                color: T.textMuted,
                marginBottom: "4px",
              }}>Drop files here or click to upload</p>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.58rem",
                color: T.textMuted,
              }}>PDF, DOCX, PPTX, TXT, CSV, XLSX — multiple files allowed</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,.csv,.xlsx"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setUploadedFiles((prev) => [...prev, ...files]);
                e.target.value = "";
              }}
            />
            {uploadedFiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {uploadedFiles.map((f, i) => (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: "8px",
                  }}>
                    <span style={{
                      fontFamily: "'Hanken Grotesk', sans-serif",
                      fontSize: "0.8rem",
                      color: T.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>{f.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setUploadedFiles((prev) => prev.filter((_, j) => j !== i)); }}
                      style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", flexShrink: 0, marginLeft: "8px", fontSize: "0.9rem" }}
                    >x</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.62rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.textMuted,
              display: "block",
              marginBottom: "8px",
            }}>Difficulty</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {["easy", "medium", "hard", "mixed"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border: `1px solid ${difficulty === d ? T.text : T.border}`,
                    background: difficulty === d ? T.surfaceHover : T.surface,
                    color: difficulty === d ? T.text : T.textMuted,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.62rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    borderRadius: "999px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >{d}</button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.62rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.textMuted,
              display: "block",
              marginBottom: "8px",
            }}>Number of Questions</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[5, 10, 15, 20, 25, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  style={{
                    padding: "8px 14px",
                    border: `1px solid ${count === n ? T.text : T.border}`,
                    background: count === n ? T.surfaceHover : T.surface,
                    color: count === n ? T.text : T.textMuted,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.7rem",
                    borderRadius: "999px",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >{n}</button>
              ))}
            </div>
          </div>

          {/* Timer */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "10px",
            }}>
              <label style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.62rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.textMuted,
              }}>Timer per Question</label>
              <button
                onClick={() => setTimerEnabled((v) => !v)}
                style={{
                  width: "40px",
                  height: "22px",
                  borderRadius: "999px",
                  border: `1px solid ${T.border}`,
                  background: timerEnabled ? T.text : "transparent",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                }}
              >
                <div style={{
                  position: "absolute",
                  top: "2px",
                  left: timerEnabled ? "20px" : "2px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: timerEnabled ? T.bg : T.textMuted,
                  transition: "left 0.2s ease",
                }} />
              </button>
            </div>
            {timerEnabled && (
              <div style={{ display: "flex", gap: "8px" }}>
                {TIMER_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => setTimerSeconds(opt.seconds)}
                    style={{
                      flex: 1,
                      padding: "8px",
                      border: `1px solid ${timerSeconds === opt.seconds ? T.text : T.border}`,
                      background: timerSeconds === opt.seconds ? T.surfaceHover : T.surface,
                      color: timerSeconds === opt.seconds ? T.text : T.textMuted,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.65rem",
                      borderRadius: "999px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={startQuiz}
            disabled={loading || !uploadedFiles.length}
            style={{
              width: "100%",
              padding: "14px",
              background: loading || !uploadedFiles.length ? T.surface : T.text,
              color: loading || !uploadedFiles.length ? T.textMuted : T.bg,
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "0.95rem",
              border: `1px solid ${loading || !uploadedFiles.length ? T.border : "transparent"}`,
              borderRadius: "999px",
              cursor: loading || !uploadedFiles.length ? "not-allowed" : "pointer",
              transition: "opacity 0.2s ease",
            }}
          >{loading ? "Generating Quiz..." : "Start Quiz"}</button>
        </div>
      </div>
    );
  }

  // ─── QUIZ ────────────────────────────────────────────────
  if (state === "quiz" && currentQuestion) {
    const diffColor = currentQuestion.difficulty === "easy"
      ? T.green : currentQuestion.difficulty === "hard"
      ? T.red : T.yellow;
    const selectedAnswer = answers[currentQ];

    return (
      <div style={{ display: "flex", height: "100%", overflow: "hidden", background: T.bg }}>

        {/* Left — question grid */}
        <div style={{
          width: "200px",
          minWidth: "200px",
          borderRight: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          background: T.bg,
          padding: "16px",
        }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.55rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textMuted,
            marginBottom: "12px",
          }}>Questions</p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "5px",
            marginBottom: "16px",
          }}>
            {questions.map((_, i) => {
              const isActive = i === currentQ;
              const isAnswered = answers[i] !== null;
              const isTimedOut = timesUp[i];
              return (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  style={{
                    aspectRatio: "1",
                    border: `1px solid ${isActive ? T.text : isTimedOut ? "rgba(248,113,113,0.4)" : isAnswered ? "rgba(74,222,128,0.4)" : T.border}`,
                    background: isActive ? T.text : isTimedOut ? T.redBg : isAnswered ? T.greenBg : T.surface,
                    color: isActive ? T.bg : isTimedOut ? T.red : isAnswered ? T.green : T.textMuted,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.6rem",
                    fontWeight: isActive ? 700 : 400,
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >{i + 1}</button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "auto" }}>
            {[
              { color: T.green, label: "Answered" },
              { color: T.textMuted, label: "Not answered" },
              { color: T.red, label: "Timed out" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: item.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.52rem", color: T.textMuted }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Submit + Exit */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
            <button
              onClick={submitQuiz}
              style={{
                padding: "10px",
                background: T.text,
                border: "none",
                borderRadius: "999px",
                color: T.bg,
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >Submit ({answeredCount}/{questions.length})</button>
            <button
              onClick={exitQuiz}
              style={{
                padding: "10px",
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: "999px",
                color: T.textMuted,
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >Exit Quiz</button>
          </div>
        </div>

        {/* Right — question */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
          {/* Top bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}>
            <div style={{ flex: 1, marginRight: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.62rem",
                  color: T.textMuted,
                }}>Q{currentQ + 1} / {questions.length}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.62rem",
                  color: diffColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}>{currentQuestion.difficulty}</span>
              </div>
              <div style={{ height: "3px", background: T.border, borderRadius: "999px" }}>
                <div style={{
                  height: "100%",
                  width: `${((currentQ + 1) / questions.length) * 100}%`,
                  background: T.text,
                  borderRadius: "999px",
                  transition: "width 0.3s",
                }} />
              </div>
            </div>

            {timerEnabled && (
              <div style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                border: `2px solid ${timeLeft <= 10 ? T.red : T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: timeLeft <= 10 ? T.red : T.text,
                }}>{timeLeft}</span>
              </div>
            )}
          </div>

          <div style={{ maxWidth: "620px" }}>
            <h2 style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: "1.15rem",
              fontWeight: 600,
              color: T.text,
              lineHeight: 1.6,
              marginBottom: "28px",
            }}>{currentQuestion.question}</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {currentQuestion.options.map((option) => {
                const letter = option.charAt(0);
                const isSelected = selectedAnswer === letter;
                return (
                  <button
                    key={option}
                    onClick={() => selectAnswer(letter)}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      background: isSelected ? T.surfaceHover : T.surface,
                      border: `1px solid ${isSelected ? T.text : T.border}`,
                      borderRadius: "10px",
                      color: isSelected ? T.text : T.text,
                      fontFamily: "'Hanken Grotesk', sans-serif",
                      fontSize: "0.9rem",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: isSelected ? T.text : T.bg,
                      border: `1px solid ${isSelected ? T.text : T.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      flexShrink: 0,
                      color: isSelected ? T.bg : T.textMuted,
                    }}>{letter}</span>
                    {option.slice(3)}
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button
                onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
                disabled={currentQ === 0}
                style={{
                  flex: 1, padding: "12px",
                  background: "transparent",
                  border: `1px solid ${T.border}`,
                  borderRadius: "999px",
                  color: currentQ === 0 ? T.textMuted : T.text,
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  fontSize: "0.88rem",
                  cursor: currentQ === 0 ? "not-allowed" : "pointer",
                  opacity: currentQ === 0 ? 0.5 : 1,
                }}
              >← Previous</button>
              <button
                onClick={() => setCurrentQ((q) => Math.min(questions.length - 1, q + 1))}
                disabled={currentQ === questions.length - 1}
                style={{
                  flex: 1, padding: "12px",
                  background: T.text,
                  border: "none",
                  borderRadius: "999px",
                  color: T.bg,
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  fontSize: "0.88rem",
                  cursor: currentQ === questions.length - 1 ? "not-allowed" : "pointer",
                  opacity: currentQ === questions.length - 1 ? 0.5 : 1,
                }}
              >Next →</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ─────────────────────────────────────────────
  if (state === "results") {
    const score = answers.filter((a, i) => a === questions[i]?.correct).length;
    const pct = Math.round((score / questions.length) * 100);
    const rating = (() => {
      if (pct >= 90) return { label: "Expert", color: T.green };
      if (pct >= 70) return { label: "Proficient", color: T.text };
      if (pct >= 50) return { label: "Learner", color: T.yellow };
      return { label: "Beginner", color: T.red };
    })();

    return (
      <div style={{ overflowY: "auto", height: "100%", padding: "40px 32px", background: T.bg }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          {/* Score card */}
          <div style={{
            padding: "32px",
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: "18px",
            marginBottom: "28px",
            textAlign: "center",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.62rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: T.textMuted,
              marginBottom: "16px",
            }}>Quiz Complete</div>
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: "4rem",
              fontWeight: 800,
              color: rating.color,
              lineHeight: 1,
              marginBottom: "8px",
            }}>{pct}%</div>
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: "1.2rem",
              fontWeight: 600,
              color: rating.color,
              marginBottom: "24px",
            }}>{rating.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", background: T.border, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
              {[
                { label: "Correct", value: score, color: T.green },
                { label: "Wrong", value: questions.length - score, color: T.red },
                { label: "Total", value: questions.length, color: T.text },
              ].map((stat) => (
                <div key={stat.label} style={{ padding: "14px", background: T.bg }}>
                  <p style={{ fontFamily: "'Geist', sans-serif", fontSize: "1.5rem", fontWeight: 700, color: stat.color, marginBottom: "2px" }}>{stat.value}</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.58rem", color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
            <button
              onClick={() => {
                setAnswers(new Array(questions.length).fill(null));
                setTimesUp(new Array(questions.length).fill(false));
                setCurrentQ(0);
                setSubmitted(false);
                setStartTime(Date.now());
                setState("quiz");
              }}
              style={{
                flex: 1, padding: "12px",
                background: "transparent",
                border: `1px solid ${T.border}`,
                borderRadius: "999px",
                color: T.text,
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >Retry Same Quiz</button>
            <button
              onClick={() => setState("setup")}
              style={{
                flex: 1, padding: "12px",
                background: T.text,
                border: "none",
                borderRadius: "999px",
                color: T.bg,
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >New Quiz</button>
          </div>

          {/* Full review */}
          <h3 style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "1rem",
            fontWeight: 600,
            color: T.text,
            marginBottom: "16px",
          }}>Full Review</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {questions.map((q, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.correct;
              const wasTimedOut = timesUp[i] && !userAnswer;

              return (
                <div key={i} style={{
                  padding: "18px 20px",
                  background: T.surface,
                  border: `1px solid ${isCorrect ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
                  borderRadius: "12px",
                  borderLeft: `3px solid ${isCorrect ? T.green : T.red}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.62rem", color: T.textMuted }}>Q{i + 1}</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.6rem",
                      color: isCorrect ? T.green : T.red,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}>{wasTimedOut ? "Timed Out" : isCorrect ? "Correct" : "Wrong"}</span>
                  </div>

                  <p style={{
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: T.text,
                    lineHeight: 1.5,
                    marginBottom: "12px",
                  }}>{q.question}</p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                    {q.options.map((opt) => {
                      const letter = opt.charAt(0);
                      const isCorrectOpt = letter === q.correct;
                      const isUserOpt = letter === userAnswer;

                      let bg = "transparent";
                      let border = T.border;
                      let color = T.textMuted;

                      if (isCorrectOpt) { bg = T.greenBg; border = "rgba(74,222,128,0.3)"; color = T.green; }
                      else if (isUserOpt && !isCorrectOpt) { bg = T.redBg; border = "rgba(248,113,113,0.3)"; color = T.red; }

                      return (
                        <div key={opt} style={{
                          padding: "8px 12px",
                          background: bg,
                          border: `1px solid ${border}`,
                          borderRadius: "8px",
                          color,
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: "0.82rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.65rem", fontWeight: 700 }}>{letter}</span>
                          {opt.slice(3)}
                          {isCorrectOpt && <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>✓</span>}
                          {isUserOpt && !isCorrectOpt && <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>✗</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{
                    padding: "10px 14px",
                    background: T.bg,
                    border: `1px solid ${T.border}`,
                    borderRadius: "8px",
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: "0.82rem",
                    color: T.textMuted,
                    lineHeight: 1.6,
                  }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.6rem",
                      color: T.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}>Explanation: </span>
                    {q.explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return null;
}