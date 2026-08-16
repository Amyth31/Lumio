"use client";

import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Zap, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

type Flashcard = { id: string; question: string; answer: string };
type Quiz = {
  difficulty?: string;
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

export function StudyTools({
  documentId,
  initialSummary,
  initialFlashcards,
  initialQuizzes,
}: {
  documentId: string;
  initialSummary: string | null;
  initialFlashcards: Flashcard[];
  initialQuizzes: Quiz[];
}) {
  const [tab, setTab] = useState<"summary" | "flashcards" | "quiz">("summary");
  const [summary, setSummary] = useState(initialSummary);
  const [flashcards, setFlashcards] = useState(initialFlashcards);
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  async function generate(type: "summarize" | "flashcards" | "quiz") {
    if (cooldown) return;
    setLoading(true);
    setError(null);
    setCooldown(true);
    setSubmitted(false);
    setAnswers({});
    setTimeout(() => setCooldown(false), 3000);

    try {
      const res = await fetch(`/api/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Generation failed"); return; }
      if (type === "summarize") setSummary(data.summary);
      if (type === "flashcards") { setFlashcards(data.flashcards); setExpanded({}); }
      if (type === "quiz") setQuizzes(data.questions);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const allAnswered = quizzes.length > 0 && quizzes.every((q) => answers[q.id]);
  const score = submitted
    ? quizzes.filter((q,qi) => answers[qi]?.startsWith(q.correct_answer)).length
    : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-neutral-800">
        {[
          { key: "summary", label: "Summary", icon: BookOpen },
          { key: "flashcards", label: "Flashcards", icon: Zap },
          { key: "quiz", label: "Quiz", icon: HelpCircle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex flex-1 items-center justify-center gap-1 py-3 text-xs uppercase tracking-widest transition-colors ${
              tab === key
                ? "border-b-2 border-cyan-400 text-cyan-400"
                : "text-neutral-500 hover:text-white"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        {/* Summary */}
        {tab === "summary" && (
          <div className="space-y-3">
            {!summary ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500 mb-4">No summary yet.</p>
                <Button
                  onClick={() => generate("summarize")}
                  disabled={loading || cooldown}
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-600 text-black"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Generate Summary
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="whitespace-pre-wrap text-sm text-neutral-200 leading-relaxed">
                  {summary}
                </div>
                <Button
                  onClick={() => generate("summarize")}
                  disabled={loading || cooldown}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Regenerate
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Flashcards */}
        {tab === "flashcards" && (
          <div className="space-y-2">
            {flashcards.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500 mb-4">No flashcards yet.</p>
                <Button
                  onClick={() => generate("flashcards")}
                  disabled={loading || cooldown}
                  size="sm"
                  className="bg-cyan-500 hover:bg-cyan-600 text-black"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Generate Flashcards
                </Button>
              </div>
            ) : (
              <>
                {flashcards.map((card, index) => (
                  <div key={index} className="border border-neutral-800">
                    <div className="p-3">
                      <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
                        Q{index + 1}
                      </p>
                      <p className="text-sm text-white">{card.question}</p>
                      <button
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [index]: !e[index] }))
                        }
                        className="flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {expanded[index] ? (
                          <>
                            <ChevronUp className="h-3 w-3" /> Hide Answer
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" /> View Answer
                          </>
                        )}
                      </button>
                    </div>
                    {expanded[index] && (
                      <div className="border-t border-neutral-800 bg-neutral-900 p-3">
                        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
                          Answer
                        </p>
                        <p className="text-sm text-neutral-200">{card.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  onClick={() => generate("flashcards")}
                  disabled={loading || cooldown}
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                >
                  Regenerate
                </Button>
              </>
            )}
          </div>
        )}

        {/* Quiz */}
        {tab === "quiz" && (
  <div className="space-y-4">
    {quizzes.length === 0 ? (
      <div className="text-center py-8">
        <p className="text-sm text-neutral-500 mb-4">No quiz yet.</p>
        <Button
          onClick={() => generate("quiz")}
          disabled={loading || cooldown}
          size="sm"
          className="bg-cyan-500 hover:bg-cyan-600 text-black"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Generate Quiz
        </Button>
      </div>
    ) : (
      <>
        {submitted && (
          <div style={{
            border: "1px solid var(--accent-border)",
            background: "var(--accent-bg)",
            padding: "12px 16px",
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.65rem",
            color: "var(--accent)",
            textAlign: "center",
            marginBottom: "16px",
          }}>
            Score: {score}/{quizzes.length} —{" "}
            {score === quizzes.length ? "Perfect!" : score >= quizzes.length / 2 ? "Good job!" : "Keep studying!"}
          </div>
        )}

        {quizzes.map((q, qi) => {
          const diffColor = (q as any).difficulty === "easy"
            ? "var(--green)"
            : q.difficulty === "hard"
            ? "var(--red)"
            : "var(--yellow)";

          return (
            <div key={qi} style={{
              border: "1px solid var(--border)",
              marginBottom: "12px",
            }}>
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "8px",
              }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.6 }}>
                  {qi + 1}. {q.question}
                </p>
                {q.difficulty && (
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.48rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    border: `1px solid ${diffColor}`,
                    color: diffColor,
                    padding: "2px 6px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {q.difficulty}
                  </span>
                )}
              </div>
              <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {q.options.map((opt: string) => {
                  const isSelected = answers[qi] === opt;
                  const isCorrect = submitted && opt.startsWith(q.correct_answer);
                  const isWrong = submitted && isSelected && !isCorrect;

                  return (
                    <button
                      key={opt}
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: opt }))}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        fontFamily: "'Space Mono', monospace",
                        fontSize: "0.62rem",
                        border: isCorrect
                          ? "1px solid var(--green)"
                          : isWrong
                          ? "1px solid var(--red)"
                          : isSelected
                          ? "1px solid var(--accent-border)"
                          : "1px solid var(--border)",
                        background: isCorrect
                          ? "rgba(0,230,118,0.05)"
                          : isWrong
                          ? "rgba(255,71,87,0.05)"
                          : isSelected
                          ? "var(--accent-bg)"
                          : "transparent",
                        color: isCorrect
                          ? "var(--green)"
                          : isWrong
                          ? "var(--red)"
                          : isSelected
                          ? "var(--accent)"
                          : "var(--text-secondary)",
                        cursor: submitted ? "default" : "pointer",
                        borderRadius: 0,
                        transition: "all 0.15s",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div style={{
                  padding: "8px 16px",
                  borderTop: "1px solid var(--border)",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.58rem",
                  color: "var(--text-muted)",
                  fontStyle: "italic",
                }}>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}

        {!submitted ? (
          <button
            onClick={() => setSubmitted(true)}
            disabled={Object.keys(answers).length < quizzes.length}
            style={{
              width: "100%",
              padding: "12px",
              background: Object.keys(answers).length < quizzes.length
                ? "var(--border)"
                : "var(--accent)",
              border: "none",
              color: "#000",
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: "0.72rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: Object.keys(answers).length < quizzes.length ? "not-allowed" : "pointer",
              borderRadius: 0,
            }}
          >
            {Object.keys(answers).length < quizzes.length
              ? `Answer all questions (${Object.keys(answers).length}/${quizzes.length})`
              : "Submit Quiz"}
          </button>
        ) : (
          <button
            onClick={() => { generate("quiz"); setAnswers({}); }}
            disabled={loading || cooldown}
            style={{
              width: "100%",
              padding: "12px",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: "0.72rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 0,
            }}
          >
            New Quiz
          </button>
        )}
      </>
    )}
  </div>
)}
        
      </div>
    </div>
  );
}