import { createClient } from "@/lib/supabase/server";
import { UploadButton } from "@/components/dashboard/upload-button";
import { DeleteButton } from "@/components/dashboard/delete-button";
import Link from "next/link";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: "40px 48px" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "24px",
        marginBottom: "32px",
      }}>
        <div>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.56rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: "6px",
          }}>Your PDFs</p>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800 }}>Library</h1>
        </div>
        <UploadButton />
      </div>

      {!documents || documents.length === 0 ? (
        <div style={{
          border: "1px solid var(--border)",
          padding: "48px",
          textAlign: "center",
        }}>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.65rem",
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}>No documents yet.</p>
          <p style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.56rem",
            color: "var(--text-muted)",
          }}>Upload a PDF to get started</p>
        </div>
      ) : (
        <div style={{
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
        }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                padding: "16px 20px",
                transition: "background 0.15s",
              }}
            >
              <Link
                href={`/library/${doc.id}`}
                style={{
                  flex: 1,
                  textDecoration: "none",
                  color: "inherit",
                  minWidth: 0,
                }}
              >
                <p style={{
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {doc.title}
                </p>
                <p style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "0.54rem",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}>
                  {doc.page_count ? `${doc.page_count} pages · ` : ""}
                  <span style={{
                    color: doc.status === "ready"
                      ? "var(--green)"
                      : doc.status === "failed"
                      ? "var(--red)"
                      : "var(--yellow)",
                  }}>
                    {doc.status}
                  </span>
                </p>
              </Link>
              <DeleteButton documentId={doc.id} storagePath={doc.storage_path} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}