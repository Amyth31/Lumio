"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

export function UploadButton() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      if (data.errors && data.errors.length > 0) {
        setError(data.errors.join(", "));
      }

      // trigger processing for each uploaded doc
      (data.results || []).forEach((r: { documentId: string }) => {
        fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: r.documentId }),
        });
      });

      router.refresh();

      if (data.results && data.results.length === 1) {
        router.push(`/library/${data.results[0].documentId}`);
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {error && (
        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.58rem", color: "var(--red)", maxWidth: "300px" }}>
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        multiple
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          background: "var(--accent)",
          border: "none",
          color: "#000",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: "0.65rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: uploading ? "not-allowed" : "pointer",
          borderRadius: 0,
          opacity: uploading ? 0.6 : 1,
        }}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload Files
          </>
        )}
      </button>
    </div>
  );
}