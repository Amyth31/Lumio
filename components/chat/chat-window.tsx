"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ChatWindow({
  documentId,
  initialMessages,
}: {
  documentId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, message: userMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch {
      setError("Network error. Try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-4 py-2">
        <p className="text-xs text-neutral-500 uppercase tracking-widest">Chat with PDF</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-600 text-center mt-8">
            Ask anything about this document.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-white"
                  : "bg-neutral-900 border border-neutral-800 text-neutral-200"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="border border-neutral-800 bg-neutral-900 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-2 border-t border-neutral-800 p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question... (Enter to send)"
          className="min-h-[44px] flex-1 resize-none bg-neutral-900 border-neutral-800 text-white"
          rows={1}
        />
        <Button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          size="icon"
          className="bg-cyan-500 hover:bg-cyan-600 text-black"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}