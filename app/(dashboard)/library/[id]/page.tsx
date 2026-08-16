"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StudyTools } from "@/components/study/study-tools";

type Document = {
  id: string;
  title: string;
  status: string;
  page_count: number | null;
};

type Flashcard = { id: string; question: string; answer: string };
type Quiz = {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<Document | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) { router.push("/library"); return; }
        setDoc(data);
        setLoading(false);
      });

    supabase
      .from("summaries")
      .select("content")
      .eq("document_id", id)
      .single()
      .then(({ data }) => setSummary(data?.content ?? null));

    supabase
      .from("flashcards")
      .select("*")
      .eq("document_id", id)
      .then(({ data }) => setFlashcards(data ?? []));

    supabase
      .from("quizzes")
      .select("*")
      .eq("document_id", id)
      .then(({ data }) => setQuizzes(data ?? []));
  }, [id]);

  if (loading || !doc) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontFamily: "'Space Mono', monospace",
        fontSize: "0.62rem",
        color: "var(--text-muted)",
      }}>Loading...</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "20px 32px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <button
            onClick={() => router.push("/library")}
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.5rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              marginBottom: "6px",
              padding: 0,
            }}
          >← Library</button>
          <h1 style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "1.2rem",
            fontWeight: 800,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "500px",
          }}>{doc.title}</h1>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.5rem",
            color: "var(--text-muted)",
            marginTop: "4px",
          }}>
            {doc.page_count ? `${doc.page_count} pages · ` : ""}
            <span style={{
              color: doc.status === "ready" ? "var(--green)" : "var(--yellow)",
            }}>{doc.status}</span>
          </p>
        </div>

        <button
          onClick={async () => {
            const res = await fetch("/api/chat-sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ documentIds: [id], title: doc.title }),
            });
            const data = await res.json();
            if (data.sessionId) router.push(`/chat/${data.sessionId}`);
          }}
          style={{
            padding: "10px 20px",
            border: "none",
            background: "var(--accent)",
            color: "#000",
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.6rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >Chat with this doc</button>
      </div>

      {/* Study Tools — Summary, Flashcards, Quiz */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <StudyTools
          documentId={id}
          initialSummary={summary}
          initialFlashcards={flashcards}
          initialQuizzes={quizzes}
        />
      </div>
    </div>
  );
}