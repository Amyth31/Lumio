"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AnalyticsData = {
  totalDocs: number;
  readyDocs: number;
  totalSessions: number;
  totalMessages: number;
  messagesPerDay: { date: string; count: number }[];
  streak: number;
  topSessions: string[];
  plan: string;
  memberSince: string;
  recentDocs: { id: string; title: string; status: string; page_count: number }[];
};

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontFamily: "'Space Mono', monospace",
        fontSize: "0.62rem",
        color: "var(--text-muted)",
        letterSpacing: "0.1em",
      }}>
        Loading...
      </div>
    );
  }

  if (!data) return null;

  const maxCount = Math.max(...data.messagesPerDay.map((d) => d.count), 1);

  const statBoxStyle: React.CSSProperties = {
    border: "1px solid var(--border)",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "var(--surface)",
  };

  const statLabelStyle: React.CSSProperties = {
    fontFamily: "'Space Mono', monospace",
    fontSize: "0.48rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  };

  const statValueStyle: React.CSSProperties = {
    fontFamily: "'Syne', sans-serif",
    fontSize: "2rem",
    fontWeight: 800,
    color: "var(--text-primary)",
    lineHeight: 1,
  };

  return (
    <div style={{ padding: "40px 48px", overflowY: "auto", height: "100%" }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        paddingBottom: "24px",
        marginBottom: "32px",
      }}>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.56rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "6px",
        }}>Your Stats</p>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>
          Analytics
        </h1>
      </div>

      {/* Stat cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "16px",
        marginBottom: "32px",
      }}>
        <div style={statBoxStyle}>
          <span style={statLabelStyle}>Study Streak</span>
          <span style={{ ...statValueStyle, color: "var(--accent)" }}>{data.streak}</span>
          <span style={{ ...statLabelStyle, fontSize: "0.44rem" }}>days in a row</span>
        </div>
        <div style={statBoxStyle}>
          <span style={statLabelStyle}>Documents</span>
          <span style={statValueStyle}>{data.readyDocs}</span>
          <span style={{ ...statLabelStyle, fontSize: "0.44rem" }}>{data.totalDocs} uploaded total</span>
        </div>
        <div style={statBoxStyle}>
          <span style={statLabelStyle}>Chats</span>
          <span style={statValueStyle}>{data.totalSessions}</span>
          <span style={{ ...statLabelStyle, fontSize: "0.44rem" }}>sessions started</span>
        </div>
        <div style={statBoxStyle}>
          <span style={statLabelStyle}>Questions Asked</span>
          <span style={statValueStyle}>{data.totalMessages}</span>
          <span style={{ ...statLabelStyle, fontSize: "0.44rem" }}>
            {data.plan === "premium" ? "Premium" : "Free"} plan
          </span>
        </div>
      </div>

      {/* Activity chart + top sessions */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: "16px",
        marginBottom: "32px",
      }}>

        {/* Bar chart — messages per day */}
        <div style={{
          border: "1px solid var(--border)",
          padding: "24px",
          background: "var(--surface)",
        }}>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.52rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "20px",
          }}>Questions Asked — Last 7 Days</p>

          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "8px",
            height: "120px",
          }}>
            {data.messagesPerDay.map((day) => {
              const height = maxCount === 0 ? 0 : Math.max((day.count / maxCount) * 100, day.count > 0 ? 8 : 0);
              const label = new Date(day.date).toLocaleDateString("en-IN", { weekday: "short" });
              return (
                <div key={day.date} style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  height: "100%",
                  justifyContent: "flex-end",
                }}>
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.44rem",
                    color: day.count > 0 ? "var(--accent)" : "var(--text-muted)",
                  }}>{day.count > 0 ? day.count : ""}</span>
                  <div style={{
                    width: "100%",
                    height: `${height}%`,
                    background: day.count > 0 ? "var(--accent)" : "var(--border)",
                    transition: "height 0.3s",
                    minHeight: "2px",
                  }} />
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.44rem",
                    color: "var(--text-muted)",
                    letterSpacing: "0.05em",
                  }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top sessions */}
        <div style={{
          border: "1px solid var(--border)",
          padding: "24px",
          background: "var(--surface)",
        }}>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.52rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "16px",
          }}>Recent Topics</p>

          {data.topSessions.length === 0 ? (
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.55rem",
              color: "var(--text-muted)",
            }}>No chats yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.topSessions.map((title, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}>
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.48rem",
                    color: "var(--accent)",
                    flexShrink: 0,
                  }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.55rem",
                    color: "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>{title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent docs */}
      <div style={{
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "24px",
        marginBottom: "32px",
      }}>
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.52rem",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: "16px",
        }}>Recent Documents</p>

        {data.recentDocs.length === 0 ? (
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.55rem",
            color: "var(--text-muted)",
          }}>No documents yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {data.recentDocs.map((doc, i) => (
              <div key={doc.id} style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: i < data.recentDocs.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.48rem",
                    color: "var(--text-muted)",
                  }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.6rem",
                    color: "var(--text-primary)",
                  }}>{doc.title}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  {doc.page_count && (
                    <span style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "0.48rem",
                      color: "var(--text-muted)",
                    }}>{doc.page_count}p</span>
                  )}
                  <span style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: "0.48rem",
                    color: doc.status === "ready" ? "var(--green)" : doc.status === "failed" ? "var(--red)" : "var(--yellow)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>{doc.status}</span>
                  <button
                    onClick={() => router.push(`/chat/${doc.id}`)}
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: "0.48rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      background: "none",
                      border: "1px solid var(--border)",
                      color: "var(--accent)",
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >Chat</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member since */}
      {data.memberSince && (
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.48rem",
          color: "var(--text-muted)",
          letterSpacing: "0.1em",
          textAlign: "center",
        }}>
          Member since {new Date(data.memberSince).toLocaleDateString("en-IN", {
            day: "numeric", month: "long", year: "numeric"
          })}
        </p>
      )}
    </div>
  );
}