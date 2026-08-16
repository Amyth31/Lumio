"use client";

import { useState, useEffect, useRef } from "react";

type NotesSection = {
  heading: string;
  content: string;
  bullets: string[];
};

type Formula = {
  name: string;
  expression: string;
  explanation: string;
  example?: string;
};

type Notes = {
  title: string;
  overview: string;
  keyPoints: string[];
  sections: NotesSection[];
  formulas?: Formula[];
  concepts: string[];
  takeaways: string[];
};

type HistoryItem = {
  id: string;
  url: string;
  title: string;
  created_at: string;
  is_pinned?: boolean;
};

// ---- shared tokens (mirrors landing/login/sidebar/dashboard/flashcards/notes/quiz) ----
const T = {
  bg: "#0c0c0d",
  surface: "#131314",
  surfaceHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
  red: "#f87171",
  green: "#4ade80",
};

export default function YouTubeNotesPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingNote, setFetchingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchHistory(); }, []);
  useEffect(() => { if (editingId) editInputRef.current?.focus(); }, [editingId]);

  async function fetchHistory() {
    const res = await fetch("/api/youtube");
    const data = await res.json();
    setHistory(data.history ?? []);
  }

  async function handleSubmit() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setNotes(null);
    setActiveId(null);

    const res = await fetch("/api/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setNotes(data.notes);
    setActiveId(data.id);
    setHistory((prev) => [
      { id: data.id, url, title: data.notes.title, created_at: new Date().toISOString(), is_pinned: false },
      ...prev.filter((h) => h.id !== data.id),
    ]);
  }

  async function handleHistoryClick(item: HistoryItem) {
    if (activeId === item.id) return;
    setFetchingNote(true);
    setError(null);
    setNotes(null);
    setActiveId(item.id);
    setUrl(item.url);

    const res = await fetch(`/api/youtube?id=${item.id}`);
    const data = await res.json();
    setFetchingNote(false);

    if (!res.ok) { setError(data.error ?? "Failed to load notes."); return; }
    setNotes(data.notes);
  }

  async function handlePin(item: HistoryItem) {
    const res = await fetch("/api/youtube", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, is_pinned: !item.is_pinned }),
    });
    if (res.ok) {
      setHistory((prev) =>
        prev.map((h) => h.id === item.id ? { ...h, is_pinned: !h.is_pinned } : h)
          .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
      );
    }
    setMenuOpenId(null);
  }

  async function handleDelete(item: HistoryItem) {
    if (!confirm("Delete these notes?")) return;
    const res = await fetch("/api/youtube", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (res.ok) {
      setHistory((prev) => prev.filter((h) => h.id !== item.id));
      if (activeId === item.id) { setNotes(null); setActiveId(null); setUrl(""); }
    }
    setMenuOpenId(null);
  }

  async function handleRename(item: HistoryItem) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === item.title) { setEditingId(null); return; }
    const res = await fetch("/api/youtube", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, title: trimmed }),
    });
    if (res.ok) {
      setHistory((prev) => prev.map((h) => h.id === item.id ? { ...h, title: trimmed } : h));
      if (notes && activeId === item.id) setNotes({ ...notes, title: trimmed });
    }
    setEditingId(null);
  }

  function handleCopy() {
    if (!notes) return;
    const text = [
      `# ${notes.title}`,
      `\n## Overview\n${notes.overview}`,
      `\n## Key Points\n${notes.keyPoints?.map((p) => `• ${p}`).join("\n")}`,
      notes.formulas?.length ? `\n## Formulas\n${notes.formulas.map((f) => `${f.name}: ${f.expression}\n${f.explanation}${f.example ? `\nExample: ${f.example}` : ""}`).join("\n\n")}` : "",
      ...notes.sections?.map((s) => `\n## ${s.heading}\n${s.content}\n${s.bullets?.map((b) => `• ${b}`).join("\n")}`) ?? [],
      `\n## Key Concepts\n${notes.concepts?.join(", ")}`,
      `\n## Takeaways\n${notes.takeaways?.map((t) => `• ${t}`).join("\n")}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isLoading = loading || fetchingNote;
  const pinnedHistory = history.filter((h) => h.is_pinned);
  const unpinnedHistory = history.filter((h) => !h.is_pinned);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: T.bg }}>

      {/* Left panel */}
      <div style={{
        width: "300px",
        minWidth: "300px",
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        background: T.bg,
      }}>
        <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textMuted,
            marginBottom: "6px",
          }}>Learn</div>
          <h1 style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "1.3rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: T.text,
            marginBottom: "16px",
          }}>YouTube Notes</h1>

          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Paste YouTube URL..."
            style={{
              width: "100%",
              padding: "10px 12px",
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: "10px",
              color: T.text,
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontSize: "0.85rem",
              outline: "none",
              marginBottom: "10px",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            style={{
              width: "100%",
              padding: "10px",
              background: loading || !url.trim() ? T.surface : T.text,
              color: loading || !url.trim() ? T.textMuted : T.bg,
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: "0.85rem",
              border: `1px solid ${loading || !url.trim() ? T.border : "transparent"}`,
              borderRadius: "999px",
              cursor: loading || !url.trim() ? "not-allowed" : "pointer",
              transition: "opacity 0.2s ease",
            }}
          >{loading ? "Generating..." : "Generate Notes"}</button>

          {error && (
            <div style={{
              marginTop: "10px",
              padding: "10px 12px",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.25)",
              borderRadius: "8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.68rem",
              color: T.red,
            }}>{error}</div>
          )}
        </div>

        {/* History */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {history.length === 0 && (
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              color: T.textMuted,
              textAlign: "center",
              padding: "24px 16px",
            }}>No notes yet</p>
          )}

          {pinnedHistory.length > 0 && (
            <>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.55rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.textMuted,
                padding: "8px 16px 4px",
              }}>Pinned</p>
              {pinnedHistory.map((item) => (
                <HistoryItemRow
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  hovered={hoveredId === item.id}
                  menuOpen={menuOpenId === item.id}
                  editing={editingId === item.id}
                  editValue={editValue}
                  editInputRef={editInputRef}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => { setHoveredId(null); setMenuOpenId(null); }}
                  onClick={() => handleHistoryClick(item)}
                  onMenuToggle={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                  onPin={() => handlePin(item)}
                  onDelete={() => handleDelete(item)}
                  onRenameStart={() => { setEditingId(item.id); setEditValue(item.title); setMenuOpenId(null); }}
                  onRenameChange={setEditValue}
                  onRenameSubmit={() => handleRename(item)}
                  onRenameCancel={() => setEditingId(null)}
                />
              ))}
            </>
          )}

          {unpinnedHistory.length > 0 && (
            <>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.55rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.textMuted,
                padding: "8px 16px 4px",
              }}>Recent</p>
              {unpinnedHistory.map((item) => (
                <HistoryItemRow
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  hovered={hoveredId === item.id}
                  menuOpen={menuOpenId === item.id}
                  editing={editingId === item.id}
                  editValue={editValue}
                  editInputRef={editInputRef}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => { setHoveredId(null); setMenuOpenId(null); }}
                  onClick={() => handleHistoryClick(item)}
                  onMenuToggle={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                  onPin={() => handlePin(item)}
                  onDelete={() => handleDelete(item)}
                  onRenameStart={() => { setEditingId(item.id); setEditValue(item.title); setMenuOpenId(null); }}
                  onRenameChange={setEditValue}
                  onRenameSubmit={() => handleRename(item)}
                  onRenameCancel={() => setEditingId(null)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
        {!notes && !isLoading && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "12px",
            textAlign: "center",
          }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "14px",
              background: T.surface,
              border: `1px solid ${T.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.6rem",
            }}>▶</div>
            <h2 style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: "1.1rem",
              fontWeight: 600,
              color: T.text,
            }}>Paste a YouTube URL</h2>
            <p style={{
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontSize: "0.85rem",
              color: T.textMuted,
              maxWidth: "320px",
              lineHeight: 1.6,
            }}>
              Get detailed structured notes, formulas, key concepts, and takeaways from any YouTube lecture.
            </p>
          </div>
        )}

        {isLoading && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: "16px",
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              border: `2px solid ${T.border}`,
              borderTop: `2px solid ${T.text}`,
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.75rem",
              color: T.textMuted,
              letterSpacing: "0.06em",
            }}>{fetchingNote ? "Loading notes..." : "Fetching transcript and generating detailed notes..."}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {notes && !isLoading && (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>

            {/* Title + copy */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: "32px",
              gap: "16px",
            }}>
              <div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                  marginBottom: "6px",
                }}>Generated Notes</div>
                <h2 style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: T.text,
                  lineHeight: 1.2,
                }}>{notes.title}</h2>
              </div>
              <button
                onClick={handleCopy}
                style={{
                  padding: "8px 18px",
                  background: copied ? "rgba(74,222,128,0.1)" : "transparent",
                  border: `1px solid ${copied ? "rgba(74,222,128,0.35)" : T.border}`,
                  borderRadius: "999px",
                  color: copied ? T.green : T.text,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.68rem",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                }}
              >{copied ? "Copied!" : "Copy Notes"}</button>
            </div>

            {/* Overview */}
            <div style={{
              padding: "20px 24px",
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: "14px",
              marginBottom: "24px",
            }}>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.textMuted,
                marginBottom: "10px",
              }}>Overview</p>
              <p style={{
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontSize: "0.95rem",
                color: T.text,
                lineHeight: 1.8,
              }}>{notes.overview}</p>
            </div>

            {/* Key Points */}
            {notes.keyPoints?.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: "12px",
                }}>Key Points</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {notes.keyPoints.map((point, i) => (
                    <div key={i} style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start",
                      padding: "12px 16px",
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: "10px",
                    }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.65rem",
                        color: T.textMuted,
                        flexShrink: 0,
                        marginTop: "2px",
                      }}>{String(i + 1).padStart(2, "0")}</span>
                      <p style={{
                        fontFamily: "'Hanken Grotesk', sans-serif",
                        fontSize: "0.88rem",
                        color: T.text,
                        lineHeight: 1.7,
                      }}>{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulas */}
            {notes.formulas && notes.formulas.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: "12px",
                }}>Formulas & Equations</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {notes.formulas.map((formula, i) => (
                    <div key={i} style={{
                      padding: "18px 20px",
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: "12px",
                    }}>
                      <p style={{
                        fontFamily: "'Geist', sans-serif",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: T.text,
                        marginBottom: "10px",
                      }}>{formula.name}</p>
                      <p style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "1rem",
                        color: T.text,
                        marginBottom: "10px",
                        padding: "10px 14px",
                        background: T.bg,
                        border: `1px solid ${T.border}`,
                        borderRadius: "8px",
                        letterSpacing: "0.04em",
                      }}>{formula.expression}</p>
                      <p style={{
                        fontFamily: "'Hanken Grotesk', sans-serif",
                        fontSize: "0.85rem",
                        color: T.textMuted,
                        lineHeight: 1.6,
                        marginBottom: formula.example ? "8px" : "0",
                      }}>{formula.explanation}</p>
                      {formula.example && (
                        <p style={{
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: "0.82rem",
                          color: T.textMuted,
                          lineHeight: 1.6,
                          borderTop: `1px solid ${T.border}`,
                          paddingTop: "8px",
                          marginTop: "4px",
                        }}>Example: {formula.example}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sections */}
            {notes.sections?.map((section, i) => (
              <div key={i} style={{ marginBottom: "24px" }}>
                <h3 style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                  <span style={{
                    width: "4px", height: "16px",
                    background: T.textMuted,
                    borderRadius: "2px",
                    display: "inline-block",
                    flexShrink: 0,
                  }} />
                  {section.heading}
                </h3>
                {section.content && (
                  <p style={{
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: "0.88rem",
                    color: T.textMuted,
                    lineHeight: 1.8,
                    marginBottom: "12px",
                  }}>{section.content}</p>
                )}
                {section.bullets?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {section.bullets.map((bullet, j) => (
                      <div key={j} style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                        padding: "10px 14px",
                        background: T.surface,
                        borderRadius: "8px",
                      }}>
                        <span style={{ color: T.textMuted, marginTop: "4px", flexShrink: 0, fontSize: "0.7rem" }}>▸</span>
                        <p style={{
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: "0.85rem",
                          color: T.textMuted,
                          lineHeight: 1.7,
                        }}>{bullet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Concepts */}
            {notes.concepts?.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: "12px",
                }}>Key Concepts</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {notes.concepts.map((concept, i) => (
                    <span key={i} style={{
                      padding: "5px 14px",
                      background: T.surface,
                      border: `1px solid ${T.border}`,
                      borderRadius: "999px",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.7rem",
                      color: T.text,
                      letterSpacing: "0.04em",
                    }}>{concept}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Takeaways */}
            {notes.takeaways?.length > 0 && (
              <div style={{
                padding: "20px 24px",
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: "14px",
                marginBottom: "40px",
              }}>
                <h3 style={{
                  fontFamily: "'Geist', sans-serif",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: T.text,
                  marginBottom: "12px",
                }}>Key Takeaways</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {notes.takeaways.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                      <span style={{ color: T.green, flexShrink: 0, marginTop: "2px" }}>✓</span>
                      <p style={{
                        fontFamily: "'Hanken Grotesk', sans-serif",
                        fontSize: "0.88rem",
                        color: T.text,
                        lineHeight: 1.7,
                      }}>{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryItemRow({
  item, active, hovered, menuOpen, editing, editValue, editInputRef,
  onMouseEnter, onMouseLeave, onClick, onMenuToggle,
  onPin, onDelete, onRenameStart, onRenameChange, onRenameSubmit, onRenameCancel,
}: {
  item: HistoryItem;
  active: boolean;
  hovered: boolean;
  menuOpen: boolean;
  editing: boolean;
  editValue: string;
  editInputRef: React.RefObject<HTMLInputElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onMenuToggle: () => void;
  onPin: () => void;
  onDelete: () => void;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "relative" }}
    >
      <div
        onClick={editing ? undefined : onClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px 10px 16px",
          borderLeft: active ? `2px solid ${T.text}` : "2px solid transparent",
          background: active ? T.surfaceHover : hovered ? "rgba(255,255,255,0.025)" : "transparent",
          cursor: editing ? "default" : "pointer",
          transition: "all 0.15s",
          gap: "6px",
        }}
      >
        {editing ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameSubmit();
              if (e.key === "Escape") onRenameCancel();
            }}
            style={{
              flex: 1,
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: "4px",
              outline: "none",
              color: T.text,
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontSize: "0.8rem",
              padding: "2px 6px",
            }}
          />
        ) : (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontSize: "0.8rem",
              color: active ? T.text : T.textMuted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: "2px",
            }}>
              {item.is_pinned ? "📌 " : ""}{item.title}
            </p>
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              color: T.textMuted,
            }}>
              {new Date(item.created_at).toLocaleDateString("en-IN", {
                day: "numeric", month: "short",
              })}
            </p>
          </div>
        )}

        {hovered && !editing && (
          <button
            onClick={(e) => { e.stopPropagation(); onMenuToggle(); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "2px 4px", color: T.textMuted,
              fontSize: "0.75rem", flexShrink: 0,
            }}
          >•••</button>
        )}
      </div>

      {menuOpen && (
        <div style={{
          position: "absolute",
          right: "8px", top: "100%",
          zIndex: 100,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: "10px",
          display: "flex",
          flexDirection: "column",
          minWidth: "130px",
          boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}>
          {[
            { label: "Rename", action: onRenameStart, color: T.text },
            { label: item.is_pinned ? "Unpin" : "Pin", action: onPin, color: T.text },
            { label: "Delete", action: onDelete, color: T.red },
          ].map((menuItem) => (
            <button
              key={menuItem.label}
              onClick={(e) => { e.stopPropagation(); menuItem.action(); }}
              style={{
                padding: "9px 14px",
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontSize: "0.8rem",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom: menuItem.label !== "Delete" ? `1px solid ${T.border}` : "none",
                color: menuItem.color,
                cursor: "pointer",
              }}
            >{menuItem.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}