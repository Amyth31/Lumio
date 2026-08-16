import { signInWithGoogle, signInAsGuest } from "@/lib/supabase/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0c0c0d",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "0 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            background: "#131314",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "14px",
            padding: "40px",
          }}
        >
          {/* Chip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.66rem",
              color: "#8a8a86",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "22px",
            }}
          >
            AI study companion
          </div>

          {/* Logo */}
          <h1
            style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: "2.2rem",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              lineHeight: 1,
              marginBottom: "10px",
              color: "#f2f1ed",
            }}
          >
            Lumio
          </h1>

          <p
            style={{
              fontFamily: "'Hanken Grotesk', sans-serif",
              fontSize: "0.88rem",
              color: "#8a8a86",
              lineHeight: 1.6,
              marginBottom: "30px",
            }}
          >
            Upload documents. Chat with your notes.
            <br />
            Flashcards and quizzes — instantly.
          </p>

          <div
            style={{
              height: "1px",
              background: "rgba(255,255,255,0.09)",
              marginBottom: "26px",
            }}
          />

          {/* Error */}
          {error && (
            <div
              style={{
                border: "1px solid rgba(248,113,113,0.3)",
                background: "rgba(248,113,113,0.08)",
                color: "#f87171",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.72rem",
                padding: "10px 14px",
                marginBottom: "20px",
                borderRadius: "8px",
                letterSpacing: "0.02em",
              }}
            >
              {error}
            </div>
          )}

          {/* Google button — solid, matches the landing page primary CTA */}
          <form action={signInWithGoogle} style={{ marginBottom: "10px" }}>
            <button
              type="submit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                background: "#f2f1ed",
                color: "#0c0c0d",
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: "0.88rem",
                padding: "12px 24px",
                border: "none",
                borderRadius: "999px",
                cursor: "pointer",
                transition: "opacity 0.2s ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </form>

          {/* Guest button — ghost, matches the landing page secondary CTA */}
          <form action={signInAsGuest}>
            <button
              type="submit"
              style={{
                display: "block",
                width: "100%",
                background: "transparent",
                color: "#f2f1ed",
                fontFamily: "'Hanken Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: "0.88rem",
                padding: "12px 24px",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "999px",
                cursor: "pointer",
                transition: "border-color 0.2s ease",
              }}
            >
              Continue as Guest
            </button>
          </form>

          {/* Footer */}
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.64rem",
              color: "#8a8a86",
              textAlign: "center",
              marginTop: "24px",
              letterSpacing: "0.02em",
              lineHeight: 1.8,
            }}
          >
            Guest sessions limited to 4 PDFs/day
            <br />
            Powered by Groq · Jina AI · Supabase
          </p>
        </div>
      </div>
    </div>
  );
}