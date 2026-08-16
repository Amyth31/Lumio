"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type AttachedDoc = {
  id: string;
  title: string;
  status: string;
};

type ImageAttachment = {
  base64: string;
  mimeType: string;
  name: string;
};

function parseContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (parsed.answer) return parsed.answer;
    if (parsed.error) return parsed.error;
    return content;
  } catch {
    return content;
  }
}

export default function ChatSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [mounted, setMounted] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();

    supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages((data ?? []) as Message[]));

    supabase
      .from("chat_session_documents")
      .select("document_id, documents(id, title, status)")
      .eq("session_id", sessionId)
      .then(({ data }) => {
        const docs = (data ?? []).map((r: any) => r.documents).filter(Boolean);
        setAttachedDocs(docs);
      });
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Ctrl+V clipboard paste
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            setImages((prev) => {
              if (prev.length >= 5) {
                alert("Maximum 5 images per message.");
                return prev;
              }
              return [...prev, {
                base64,
                mimeType: item.type,
                name: `screenshot_${Date.now()}.png`,
              }];
            });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  function handleVoiceInput() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice not supported in this browser. Use Chrome.");
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
      setInput((prev) => prev ? prev + " " + transcript : transcript);
    };

    recognition.start();
  }

  async function removeDoc(docId: string) {
    const supabase = createClient();
    await supabase
      .from("chat_session_documents")
      .delete()
      .eq("session_id", sessionId)
      .eq("document_id", docId);
    setAttachedDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAttachClick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const docFiles = files.filter((f) => !f.type.startsWith("image/"));

    // Multiple images support
    for (const file of imageFiles) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setImages((prev) => {
          if (prev.length >= 5) return prev;
          return [...prev, { base64, mimeType: file.type, name: file.name }];
        });
      };
      reader.readAsDataURL(file);
    }

    if (docFiles.length > 0) {
      setUploading(true);
      const formData = new FormData();
      docFiles.forEach((f) => formData.append("files", f));

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadData.success || uploadData.results.length === 0) {
        alert(uploadData.errors?.[0] ?? "Upload failed");
        setUploading(false);
        return;
      }

      await Promise.all(
        uploadData.results.map((r: { documentId: string }) =>
          fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: r.documentId }),
          })
        )
      );

      const supabase = createClient();
      const pendingIds = new Set(
        uploadData.results.map((r: { documentId: string }) => r.documentId)
      );

      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await Promise.all(
          Array.from(pendingIds).map(async (documentId) => {
            const { data } = await supabase
              .from("documents")
              .select("id, title, status")
              .eq("id", documentId)
              .single();

            if (data?.status === "ready") {
              pendingIds.delete(documentId);
              await supabase.from("chat_session_documents").upsert({
                session_id: sessionId,
                document_id: documentId,
              });
              setAttachedDocs((prev) => [
                ...prev.filter((d) => d.id !== data.id),
                { id: data.id, title: data.title, status: data.status },
              ]);
            }
          })
        );

        if (pendingIds.size === 0 || attempts >= 60) {
          clearInterval(poll);
          setUploading(false);
          if (attempts >= 60) alert("Some files timed out. Try again.");
        }
      }, 1000);
    }
  }

  async function sendMessage() {
    if (!input.trim() && images.length === 0) return;
    setLoading(true);

    const imageLabel = images.length > 0
      ? ` [${images.length} image${images.length > 1 ? "s" : ""}]`
      : "";

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input + imageLabel,
    };
    setMessages((prev) => [...prev, userMsg]);

    const currentInput = input;
    const currentImages = [...images];
    setInput("");
    setImages([]);

    const assistantId = Date.now().toString() + "a";
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: currentInput,
          // Send array of images
          images: currentImages.map((img) => ({
            base64: img.base64,
            mimeType: img.mimeType,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: data.error ?? "Something went wrong." }
              : m
          )
        );
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const token = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Network error. Try again." }
            : m
        )
      );
    }

    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>

      {/* Attached docs bar */}
      {attachedDocs.length > 0 && (
        <div style={{
          display: "flex",
          gap: "8px",
          padding: "10px 24px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.5rem",
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginRight: "4px",
          }}>Docs:</span>
          {attachedDocs.map((doc) => (
            <div key={doc.id} style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.52rem",
              color: "var(--text-primary)",
            }}>
              {doc.title}
              <button
                onClick={() => removeDoc(doc.id)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: "0.8rem" }}
              >x</button>
            </div>
          ))}
        </div>
      )}

      {/* Image previews */}
      {images.length > 0 && (
        <div style={{
          padding: "8px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
          background: "var(--surface)",
        }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative", display: "inline-flex" }}>
              <img
                src={`data:${img.mimeType};base64,${img.base64}`}
                alt={img.name}
                style={{
                  height: "52px",
                  width: "auto",
                  maxWidth: "100px",
                  objectFit: "cover",
                  border: "1px solid var(--border)",
                }}
              />
              <button
                onClick={() => removeImage(i)}
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "var(--red)",
                  border: "none",
                  color: "#fff",
                  fontSize: "0.55rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}
              >x</button>
            </div>
          ))}
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.5rem",
            color: "var(--text-muted)",
          }}>{images.length}/5</span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {mounted && messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "80px" }}>
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.62rem",
              color: "var(--text-muted)",
              letterSpacing: "0.1em",
            }}>
              {attachedDocs.length > 0 ? "Ask anything about your attached documents." : "Attach a file or ask a study question."}
            </p>
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.52rem",
              color: "var(--text-muted)",
              marginTop: "8px",
              letterSpacing: "0.06em",
            }}>
              Ctrl+V to paste screenshots — up to 5 images per message
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "70%",
              padding: "12px 16px",
              background: msg.role === "user" ? "var(--accent)" : "var(--surface)",
              color: msg.role === "user" ? "#000" : "var(--text-primary)",
              border: "1px solid var(--border)",
              fontSize: "0.78rem",
              lineHeight: 1.7,
            }}>
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p style={{ margin: "0 0 8px 0", fontFamily: "'Space Mono', monospace", fontSize: "0.78rem", lineHeight: 1.7 }}>{children}</p>,
                    strong: ({ children }) => <strong style={{ fontWeight: 700, color: "var(--accent)" }}>{children}</strong>,
                    em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                    ul: ({ children }) => <ul style={{ paddingLeft: "16px", margin: "8px 0", fontFamily: "'Space Mono', monospace", fontSize: "0.78rem" }}>{children}</ul>,
                    ol: ({ children }) => <ol style={{ paddingLeft: "16px", margin: "8px 0", fontFamily: "'Space Mono', monospace", fontSize: "0.78rem" }}>{children}</ol>,
                    li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                    code: ({ children }) => <code style={{ background: "var(--border)", padding: "2px 6px", fontFamily: "'Space Mono', monospace", fontSize: "0.72rem" }}>{children}</code>,
                    pre: ({ children }) => <pre style={{ background: "var(--border)", padding: "12px", overflowX: "auto", margin: "8px 0", fontFamily: "'Space Mono', monospace", fontSize: "0.72rem" }}>{children}</pre>,
                    h1: ({ children }) => <h1 style={{ fontSize: "1rem", fontWeight: 700, margin: "12px 0 6px", fontFamily: "'Syne', sans-serif" }}>{children}</h1>,
                    h2: ({ children }) => <h2 style={{ fontSize: "0.9rem", fontWeight: 700, margin: "10px 0 6px", fontFamily: "'Syne', sans-serif" }}>{children}</h2>,
                    h3: ({ children }) => <h3 style={{ fontSize: "0.82rem", fontWeight: 700, margin: "8px 0 4px", fontFamily: "'Syne', sans-serif" }}>{children}</h3>,
                  }}
                >
                  {parseContent(msg.content)}
                </ReactMarkdown>
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{parseContent(msg.content)}</span>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.content === "" && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "12px 16px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.7rem",
              color: "var(--text-muted)",
            }}>
              Thinking...
            </div>
          </div>
        )}

        {uploading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "12px 16px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.7rem",
              color: "var(--text-muted)",
            }}>
              Processing file...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: "16px 24px",
        display: "flex",
        gap: "10px",
        alignItems: "flex-end",
        background: "var(--bg)",
      }}>
        <button
          onClick={() => attachInputRef.current?.click()}
          disabled={uploading}
          title="Attach files or images"
          style={{
            width: "40px",
            height: "40px",
            border: "1px solid var(--border)",
            background: "transparent",
            color: uploading ? "var(--text-muted)" : "var(--text-primary)",
            cursor: uploading ? "not-allowed" : "pointer",
            fontSize: "1.4rem",
            fontWeight: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >{uploading ? "..." : "+"}</button>
        <input
          ref={attachInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.xlsx,.xls,.txt,.md,.csv,image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleAttachClick}
        />

        <button
          onClick={handleVoiceInput}
          title="Voice input"
          style={{
            width: "40px",
            height: "40px",
            border: `1px solid ${listening ? "var(--accent)" : "var(--border)"}`,
            background: listening ? "var(--accent)" : "transparent",
            color: listening ? "#000" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "0.6rem",
            fontFamily: "'Space Mono', monospace",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            letterSpacing: "0.05em",
            fontWeight: listening ? 700 : 400,
          }}
        >{listening ? "ON" : "MIC"}</button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={listening ? "Listening..." : "Ask anything"}
          rows={1}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "var(--surface)",
            border: `1px solid ${listening ? "var(--accent)" : images.length > 0 ? "var(--accent-border)" : "var(--border)"}`,
            color: "var(--text-primary)",
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.7rem",
            resize: "none",
            outline: "none",
            lineHeight: 1.6,
            transition: "border 0.2s",
          }}
        />

        <button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && images.length === 0)}
          style={{
            padding: "10px 20px",
            height: "40px",
            border: "none",
            background: loading || (!input.trim() && images.length === 0) ? "var(--border)" : "var(--accent)",
            color: "#000",
            fontFamily: "'Space Mono', monospace",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: loading ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}