"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type SearchResult = {
  documentId: string;
  title: string;
  chunks: string[];
};

type RecentSession = {
  id: string;
  title: string;
  created_at: string;
};

export default function ChatHomePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("chat_sessions")
      .select("id, title, created_at")
      .order("created_at", { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentSessions(data ?? []));
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleSearch(query), 600);
    return () => clearTimeout(searchTimeout.current);
  }, [query]);

  async function handleSearch(q: string) {
    setSearching(true);
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setSearched(true);
    setSearching(false);
  }

  async function handleNewChat(documentId?: string) {
    setCreating(true);
    const res = await fetch("/api/chat-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentIds: documentId ? [documentId] : [],
        title: "New Chat",
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.sessionId) router.push(`/chat/${data.sessionId}`);
  }

  function handleVoiceSearch() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search not supported in this browser. Try Chrome.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setQuery(transcript);
    };

    recognition.start();
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      height: "100%",
      padding: "64px 48px 48px",
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif",
          fontSize: "2.2rem",
          fontWeight: 800,
          marginBottom: "8px",
        }}>
          LUMI<span style={{ color: "var(--accent)" }}>O</span>
        </h1>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.58rem",
          color: "var(--text-muted)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}>
          Your AI Study Companion
        </p>
      </div>

      {/* Search bar */}
      <div style={{
        width: "100%",
        maxWidth: "560px",
        marginBottom: "32px",
      }}>
        <div style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "10px 16px",
        }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", flexShrink: 0 }}>
            {searching ? "..." : "?"}
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all your documents..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.7rem",
            }}
          />
          {/* Voice button */}
          <button
            onClick={handleVoiceSearch}
            title="Voice search"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: listening ? "var(--accent)" : "var(--text-muted)",
              fontSize: "0.8rem",
              fontFamily: "'Space Mono', monospace",
              flexShrink: 0,
              padding: "0 4px",
              letterSpacing: 0,
            }}
          >
            {listening ? "[ ON ]" : "[ MIC ]"}
          </button>
        </div>

        {/* Search results */}
        {searched && (
          <div style={{
            border: "1px solid var(--border)",
            borderTop: "none",
            background: "var(--bg)",
          }}>
            {results.length === 0 ? (
              <p style={{
                padding: "16px",
                fontFamily: "'Space Mono', monospace",
                fontSize: "0.58rem",
                color: "var(--text-muted)",
              }}>No results found.</p>
            ) : (
              results.map((r) => (
                <div
                  key={r.documentId}
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                  onClick={() => handleNewChat(r.documentId)}
                >
                  <p style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    marginBottom: "6px",
                  }}>{r.title}</p>
                  {r.chunks.map((chunk, i) => (
                    <p key={i} style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "0.54rem",
                      color: "var(--text-muted)",
                      lineHeight: 1.6,
                      marginBottom: "4px",
                    }}>{chunk}</p>
                  ))}
                  <p style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.48rem",
                    color: "var(--text-muted)",
                    marginTop: "6px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}>Click to chat with this doc</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* New Chat button */}
      <button
        onClick={() => handleNewChat()}
        disabled={creating}
        style={{
          padding: "12px 32px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.65rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontWeight: 700,
          border: "1px solid var(--accent)",
          background: "transparent",
          color: "var(--accent)",
          cursor: creating ? "not-allowed" : "pointer",
          marginBottom: "40px",
        }}
      >
        {creating ? "Creating..." : "+ New Chat"}
      </button>

      {/* Recent chats */}
      {recentSessions.length > 0 && (
        <div style={{ width: "100%", maxWidth: "560px" }}>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.48rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "12px",
          }}>Recent Chats</p>
          <div style={{ border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            {recentSessions.map((s) => (
              <div
                key={s.id}
                onClick={() => router.push(`/chat/${s.id}`)}
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.6rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--text-primary)" }}>- {s.title}</span>
                <span style={{ fontSize: "0.48rem" }}>
                  {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}