"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/supabase/actions";
import { createClient } from "@/lib/supabase/client";

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  is_pinned: boolean;
};

type Profile = {
  plan: string;
  pdf_count: number;
};

const learnLinks = [
  { href: "/learn/youtube", label: "YouTube Notes" },
  { href: "/learn/notes", label: "Smart Notes" },
  { href: "/learn/quiz", label: "Quiz Arena" },
  { href: "/learn/flashcards", label: "Flashcards" },
];

// ---- shared tokens (mirrors the landing/login pages) ----
const T = {
  bg: "#0c0c0d",
  surface: "#131314",
  surfaceHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
  accent: "#3654e0",
  red: "#f87171",
  yellow: "#eab308",
};

export function Sidebar({ onTimerClick }: { onTimerClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [creating, setCreating] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [learnOpen, setLearnOpen] = useState(true);

  useEffect(() => {
    fetchSessions();
    fetchProfile();
  }, [pathname]);

  async function fetchSessions() {
    const supabase = createClient();
    const { data } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, is_pinned")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);
    setSessions(data ?? []);
  }

  async function fetchProfile() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("plan, pdf_count")
      .single();
    setProfile(data);
  }

  async function handleNewChat() {
    setCreating(true);
    const res = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: [], title: "New Chat" }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.sessionId) {
      router.push(`/chat/${data.sessionId}`);
      fetchSessions();
    }
  }

  async function handlePin(e: React.MouseEvent, session: ChatSession) {
    e.preventDefault();
    e.stopPropagation();
    const supabase = createClient();
    await supabase
      .from("chat_sessions")
      .update({ is_pinned: !session.is_pinned })
      .eq("id", session.id);
    fetchSessions();
  }

  async function handleDelete(e: React.MouseEvent, sessionId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this chat?")) return;
    const supabase = createClient();
    await supabase.from("chat_sessions").delete().eq("id", sessionId);
    fetchSessions();
    if (pathname === `/chat/${sessionId}`) router.push("/chat");
  }

  async function handleRename(sessionId: string, newTitle: string) {
    const supabase = createClient();
    await supabase
      .from("chat_sessions")
      .update({ title: newTitle })
      .eq("id", sessionId);
    fetchSessions();
  }

  const dailyLimit = profile?.plan === "premium" ? 10 : 4;
  const usedCount = profile?.pdf_count ?? 0;
  const pinnedSessions = sessions.filter((s) => s.is_pinned);
  const unpinnedSessions = sessions.filter((s) => !s.is_pinned);

  return (
    <aside style={{
      width: "260px",
      minWidth: "260px",
      borderRight: `1px solid ${T.border}`,
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: T.bg,
    }}>
      {/* Logo */}
      <div style={{
        fontFamily: "'Geist', sans-serif",
        fontWeight: 700,
        fontSize: "1.1rem",
        letterSpacing: "-0.02em",
        padding: "20px 20px 16px",
        borderBottom: `1px solid ${T.border}`,
        color: T.text,
      }}>
        Lumio
      </div>

      {/* New Chat Button */}
      <div style={{ padding: "12px 12px 8px" }}>
        <button
          onClick={handleNewChat}
          disabled={creating}
          style={{
            width: "100%",
            padding: "9px 16px",
            fontFamily: "'Hanken Grotesk', sans-serif",
            fontSize: "0.82rem",
            fontWeight: 600,
            background: T.text,
            color: T.bg,
            border: "none",
            borderRadius: "999px",
            cursor: creating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            opacity: creating ? 0.7 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          <span style={{ fontSize: "1rem", lineHeight: 1 }}>+</span>
          {creating ? "Creating..." : "New Chat"}
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>

        {/* LEARN Section */}
        <div style={{ marginBottom: "8px" }}>
          <button
            onClick={() => setLearnOpen((v) => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.textMuted,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Learn
            <span style={{ fontSize: "0.7rem", transition: "transform 0.2s", transform: learnOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
          </button>

          {learnOpen && (
            <div style={{ paddingBottom: "4px" }}>
              {learnLinks.map((link) => {
                const active = pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "7px 16px 7px 24px",
                      fontFamily: "'Hanken Grotesk', sans-serif",
                      fontSize: "0.82rem",
                      color: active ? T.text : T.textMuted,
                      background: active ? T.surfaceHover : "transparent",
                      borderLeft: active ? `2px solid ${T.text}` : "2px solid transparent",
                      textDecoration: "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: T.border, margin: "4px 12px 8px" }} />

        {/* CHATS Section */}
        <div>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textMuted,
            padding: "8px 16px 4px",
          }}>Chats</p>

          {pinnedSessions.length > 0 && (
            <>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.55rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.textMuted,
                padding: "6px 16px 2px",
                opacity: 0.6,
              }}>Pinned</p>
              {pinnedSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={pathname === `/chat/${session.id}`}
                  hovered={hoveredId === session.id}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onPin={handlePin}
                  onDelete={handleDelete}
                  onRename={handleRename}
                />
              ))}
            </>
          )}

          {unpinnedSessions.length > 0 && (
            <>
              {pinnedSessions.length > 0 && (
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.55rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.textMuted,
                  padding: "6px 16px 2px",
                  opacity: 0.6,
                }}>Recent</p>
              )}
              {unpinnedSessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={pathname === `/chat/${session.id}`}
                  hovered={hoveredId === session.id}
                  onMouseEnter={() => setHoveredId(session.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onPin={handlePin}
                  onDelete={handleDelete}
                  onRename={handleRename}
                />
              ))}
            </>
          )}

          {sessions.length === 0 && (
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              color: T.textMuted,
              textAlign: "center",
              padding: "16px",
            }}>No chats yet</p>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        {/* Usage counter */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px",
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.06em",
              color: T.textMuted,
            }}>
              {profile?.plan === "premium" ? "Premium" : "Free"} · PDFs today
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              color: usedCount >= dailyLimit ? T.red : T.textMuted,
            }}>
              {usedCount}/{dailyLimit}
            </span>
          </div>
          <div style={{ height: "2px", background: T.border, borderRadius: "999px", width: "100%" }}>
            <div style={{
              height: "100%",
              width: `${Math.min((usedCount / dailyLimit) * 100, 100)}%`,
              background: usedCount >= dailyLimit ? T.red : T.text,
              borderRadius: "999px",
              transition: "width 0.3s",
            }} />
          </div>
          {usedCount >= dailyLimit && (
            <Link href="/upgrade" style={{
              display: "block",
              marginTop: "8px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              color: T.yellow,
              textDecoration: "none",
            }}>Upgrade for more →</Link>
          )}
        </div>

        {/* Analytics */}
        <Link href="/analytics" style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          fontFamily: "'Hanken Grotesk', sans-serif",
          fontSize: "0.82rem",
          color: pathname === "/analytics" ? T.text : T.textMuted,
          textDecoration: "none",
          borderLeft: pathname === "/analytics" ? `2px solid ${T.text}` : "2px solid transparent",
        }}>Analytics</Link>

        {/* Timer */}
        {onTimerClick && (
          <button onClick={onTimerClick} style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            fontFamily: "'Hanken Grotesk', sans-serif",
            fontSize: "0.82rem",
            color: T.textMuted,
            background: "none",
            border: "none",
            width: "100%",
            cursor: "pointer",
            borderLeft: "2px solid transparent",
          }}>Timer</button>
        )}

        {/* Sign out */}
        <form action={signOut}>
          <button type="submit" style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            fontFamily: "'Hanken Grotesk', sans-serif",
            fontSize: "0.82rem",
            color: T.textMuted,
            background: "none",
            border: "none",
            width: "100%",
            cursor: "pointer",
            borderLeft: "2px solid transparent",
          }}>Sign Out</button>
        </form>
      </div>
    </aside>
  );
}

function SessionItem({
  session, active, hovered, onMouseEnter, onMouseLeave, onPin, onDelete, onRename,
}: {
  session: ChatSession;
  active: boolean;
  hovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPin: (e: React.MouseEvent, session: ChatSession) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleRenameSubmit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title) onRename(session.id, trimmed);
    setEditing(false);
  }

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => { onMouseLeave(); setMenuOpen(false); }}
      style={{ position: "relative" }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "7px 12px 7px 16px",
        borderLeft: active ? `2px solid ${T.text}` : "2px solid transparent",
        background: active ? T.surfaceHover : hovered ? "rgba(255,255,255,0.025)" : "transparent",
        transition: "all 0.1s",
        gap: "6px",
      }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") { setEditing(false); setEditValue(session.title); }
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
          <Link
            href={`/chat/${session.id}`}
            style={{
              flex: 1,
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontSize: "0.8rem",
              color: active ? T.text : T.textMuted,
              textDecoration: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {session.is_pinned ? "📌 " : ""}{session.title}
          </Link>
        )}

        {hovered && !editing && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen((v) => !v); }}
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
          position: "absolute", right: "8px", top: "100%", zIndex: 100,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: "10px",
          display: "flex", flexDirection: "column",
          minWidth: "130px",
          boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}>
          {[
            { label: "Rename", action: () => { setEditing(true); setMenuOpen(false); }, color: T.text },
            { label: session.is_pinned ? "Unpin" : "Pin", action: (e: any) => { onPin(e, session); setMenuOpen(false); }, color: T.text },
            { label: "Delete", action: (e: any) => { onDelete(e, session.id); setMenuOpen(false); }, color: T.red },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                padding: "9px 14px",
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontSize: "0.8rem",
                textAlign: "left",
                background: "none",
                border: "none",
                borderBottom: item.label !== "Delete" ? `1px solid ${T.border}` : "none",
                color: item.color,
                cursor: "pointer",
              }}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}