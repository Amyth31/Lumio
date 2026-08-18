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

// ---- shared tokens (mirrors landing/login/dashboard/learn pages) ----
const T = {
  bg: "#0c0c0d",
  surface: "#131314",
  surfaceHover: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
  red: "#f87171",
  yellow: "#eab308",
};

function Icon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "chevronLeft":
      return <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>;
    case "chevronRight":
      return <svg {...common}><path d="M9 18l6-6-6-6" /></svg>;
    case "book":
      return <svg {...common}><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17z" /><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /></svg>;
    case "chart":
      return <svg {...common}><path d="M4 20V10M12 20V4M20 20v-7" /><path d="M2 20h20" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
    case "logout":
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
    default:
      return null;
  }
}

export function Sidebar({
  onTimerClick,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  isMobile,
}: {
  onTimerClick?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  isMobile: boolean;
}) {
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

  // Auto-close the mobile drawer whenever the route changes
  useEffect(() => {
    if (isMobile) onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ---- Desktop collapsed icon rail ----
  if (collapsed && !isMobile) {
    return (
      <aside style={{
        width: "64px",
        minWidth: "64px",
        borderRight: `1px solid ${T.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100%",
        background: T.bg,
        padding: "16px 0",
      }}>
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "transparent", border: "none", color: T.textMuted,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "20px",
          }}
        ><Icon name="chevronRight" /></button>

        <button
          onClick={handleNewChat}
          title="New chat"
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: T.text, border: "none", color: T.bg,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "24px",
          }}
        ><Icon name="plus" /></button>

        <button
          onClick={onToggleCollapse}
          title="Learn"
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "transparent", border: "none", color: T.textMuted,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "10px",
          }}
        ><Icon name="book" /></button>

        <Link href="/analytics" title="Analytics" style={{
          width: "36px", height: "36px", borderRadius: "10px",
          color: pathname === "/analytics" ? T.text : T.textMuted,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "10px",
        }}><Icon name="chart" /></Link>

        {onTimerClick && (
          <button
            onClick={onTimerClick}
            title="Timer"
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "transparent", border: "none", color: T.textMuted,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><Icon name="clock" /></button>
        )}

        <div style={{ flex: 1 }} />

        <form action={signOut}>
          <button type="submit" title="Sign out" style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "transparent", border: "none", color: T.textMuted,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}><Icon name="logout" /></button>
        </form>
      </aside>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo + collapse toggle */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 16px 16px 20px",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{
          fontFamily: "'Geist', sans-serif",
          fontWeight: 700,
          fontSize: "1.1rem",
          letterSpacing: "-0.02em",
          color: T.text,
        }}>Lumio</span>
        <button
          onClick={isMobile ? onCloseMobile : onToggleCollapse}
          title={isMobile ? "Close" : "Collapse sidebar"}
          style={{
            width: "30px", height: "30px", borderRadius: "8px",
            background: "transparent", border: "none", color: T.textMuted,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        ><Icon name={isMobile ? "chevronLeft" : "chevronLeft"} /></button>
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
    </>
  );

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div
            onClick={onCloseMobile}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              zIndex: 90, backdropFilter: "blur(2px)",
            }}
          />
        )}
        <aside style={{
          position: "fixed",
          top: 0, left: 0, bottom: 0,
          width: "280px",
          zIndex: 100,
          borderRight: `1px solid ${T.border}`,
          display: "flex",
          flexDirection: "column",
          background: T.bg,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}>
          {sidebarContent}
        </aside>
      </>
    );
  }

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
      {sidebarContent}
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