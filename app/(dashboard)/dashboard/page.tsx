import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const T = {
  bg: "#0c0c0d",
  surface: "#131314",
  border: "rgba(255,255,255,0.09)",
  text: "#f2f1ed",
  textMuted: "#8a8a86",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, pdf_count, chat_count")
    .eq("id", user!.id)
    .single();

  const plan = profile?.plan ?? "free";
  const pdfCount = profile?.pdf_count ?? 0;
  const pdfLimit = plan === "premium" ? 10 : 4;
  const chatCount = profile?.chat_count ?? 0;
  const chatLimit = 20;

  return (
    <div style={{ padding: "56px 64px", maxWidth: "980px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "48px" }}>
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.66rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: T.textMuted,
          marginBottom: "10px",
        }}>
          Welcome back
        </p>
        <h1 style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: "2rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: T.text,
          margin: 0,
        }}>
          {user?.email ?? "Guest"}
        </h1>
      </div>

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "1px",
        background: T.border,
        border: `1px solid ${T.border}`,
        borderRadius: "14px",
        overflow: "hidden",
        marginBottom: "28px",
      }}>
        <div style={{ background: T.bg, padding: "22px 24px" }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textMuted,
            marginBottom: "10px",
          }}>Plan</p>
          <p style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "1.35rem",
            fontWeight: 600,
            color: T.text,
            textTransform: "capitalize",
            margin: 0,
          }}>{plan}</p>
        </div>
        <div style={{ background: T.bg, padding: "22px 24px" }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textMuted,
            marginBottom: "10px",
          }}>PDFs today</p>
          <p style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "1.35rem",
            fontWeight: 600,
            color: T.text,
            margin: 0,
          }}>
            {pdfCount}<span style={{ color: T.textMuted, fontSize: "0.9rem", fontWeight: 400 }}>/{pdfLimit}</span>
          </p>
        </div>
        <div style={{ background: T.bg, padding: "22px 24px" }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.62rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textMuted,
            marginBottom: "10px",
          }}>Chats today</p>
          <p style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: "1.35rem",
            fontWeight: 600,
            color: T.text,
            margin: 0,
          }}>
            {chatCount}<span style={{ color: T.textMuted, fontSize: "0.9rem", fontWeight: 400 }}>/{chatLimit}</span>
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "56px" }}>
        <Link href="/chat" style={{
          padding: "12px 24px",
          borderRadius: "999px",
          background: T.text,
          color: T.bg,
          fontFamily: "'Hanken Grotesk', sans-serif",
          fontSize: "0.86rem",
          fontWeight: 600,
          textDecoration: "none",
          transition: "opacity 0.2s ease",
        }}>
          New chat
        </Link>
        <Link href="/library" style={{
          padding: "12px 24px",
          borderRadius: "999px",
          background: "transparent",
          color: T.text,
          border: `1px solid ${T.border}`,
          fontFamily: "'Hanken Grotesk', sans-serif",
          fontSize: "0.86rem",
          fontWeight: 600,
          textDecoration: "none",
          transition: "border-color 0.2s ease",
        }}>
          Upload a document
        </Link>
      </div>

      {/* Recent documents */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "18px",
      }}>
        <h2 style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.66rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: T.textMuted,
          margin: 0,
        }}>Recent documents</h2>
        <Link href="/library" style={{
          fontFamily: "'Hanken Grotesk', sans-serif",
          fontSize: "0.8rem",
          color: T.textMuted,
          textDecoration: "none",
        }}>View all</Link>
      </div>

      {!documents || documents.length === 0 ? (
        <div style={{
          border: `1px dashed ${T.border}`,
          borderRadius: "16px",
          padding: "56px 24px",
          textAlign: "center",
        }}>
          <p style={{
            fontFamily: "'Hanken Grotesk', sans-serif",
            fontSize: "0.9rem",
            color: T.textMuted,
            marginBottom: "18px",
          }}>No documents yet.</p>
          <Link href="/library" style={{
            display: "inline-block",
            padding: "12px 24px",
            borderRadius: "999px",
            background: T.text,
            color: T.bg,
            fontFamily: "'Hanken Grotesk', sans-serif",
            fontSize: "0.86rem",
            fontWeight: 600,
            textDecoration: "none",
          }}>
            Upload your first PDF
          </Link>
        </div>
      ) : (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "1px",
          background: T.border,
          border: `1px solid ${T.border}`,
          borderRadius: "14px",
          overflow: "hidden",
        }}>
          {documents.map((doc) => {
            const statusColor =
              doc.status === "ready" ? "#4ade80" :
              doc.status === "failed" ? "#f87171" : "#eab308";
            return (
              <Link
                key={doc.id}
                href={`/library/${doc.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: T.bg,
                  padding: "18px 22px",
                  textDecoration: "none",
                  transition: "background 0.2s ease",
                }}
              >
                <div>
                  <p style={{
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    color: T.text,
                    margin: 0,
                  }}>{doc.title}</p>
                  <p style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.68rem",
                    color: T.textMuted,
                    marginTop: "6px",
                  }}>
                    {doc.page_count ? `${doc.page_count} pages · ` : ""}
                    {doc.status}
                  </p>
                </div>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.62rem",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "5px 12px",
                  borderRadius: "999px",
                  border: `1px solid ${statusColor}4d`,
                  color: statusColor,
                  flexShrink: 0,
                }}>
                  {doc.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}