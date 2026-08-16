import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { aiChat } from "@/lib/ai/router";
import { ChatMessage } from "@/lib/ai/groq";
import { NextResponse } from "next/server";

const FREE_CHAT_LIMIT = 20;
const PREMIUM_CHAT_LIMIT = 200;
const HISTORY_LIMIT = 20;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, message, imageBase64, imageMimeType } = await request.json();

  if (!sessionId || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Reset daily usage if new day
  await supabase.rpc("reset_daily_usage", { p_user_id: user.id });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, chat_count")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";
  const chatCount = profile?.chat_count ?? 0;
  const chatLimit = plan === "premium" ? PREMIUM_CHAT_LIMIT : FREE_CHAT_LIMIT;

  if (chatCount >= chatLimit) {
    return NextResponse.json(
      { error: `Chat limit reached (${chatLimit}/day). ${plan === "free" ? "Upgrade to premium." : "Try again tomorrow."}` },
      { status: 403 }
    );
  }

  // Verify session belongs to user
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id, title")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Get all document IDs attached to this session
  const { data: sessionDocs } = await supabase
    .from("chat_session_documents")
    .select("document_id")
    .eq("session_id", sessionId);

  const documentIds = (sessionDocs ?? []).map((r: { document_id: string }) => r.document_id);

  try {
    let context = "";

    // RAG only if documents are attached
    if (documentIds.length > 0) {
      const queryEmbedding = await generateEmbedding(message);

      const { data: chunks } = await supabase.rpc("match_chunks_multi", {
        query_embedding: queryEmbedding,
        match_document_ids: documentIds,
        match_count: 8,
      });

      context = (chunks || [])
        .map((c: { content: string }) => c.content)
        .join("\n\n---\n\n");
    }

    // Fetch conversation history BEFORE inserting the current user message,
    // otherwise the current message would show up twice in the Groq call.
    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT);

    const history: ChatMessage[] = (historyRows ?? []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    // Save user message
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    const systemPrompt = documentIds.length > 0
      ? `You are Lumio, an AI study assistant. You must respond in English only.
Answer the student's question based on the following context from their uploaded documents.
If the answer isn't in the context, say so clearly. Be concise and helpful.

Context:
${context}`
      : `You are Lumio, an AI study assistant. You must respond in English only.
No documents are attached to this chat. Answer general study questions helpfully and concisely.
If the student needs document-specific help, suggest they attach a PDF.`;

    // Build message content — support image if provided
    const userContent: object[] = [{ type: "text", text: message }];
    if (imageBase64 && imageMimeType) {
      userContent.unshift({
        type: "image",
        source: {
          type: "base64",
          media_type: imageMimeType,
          data: imageBase64,
        },
      });
    }

    const answer = await aiChat(systemPrompt, message, history);

    // Save assistant message
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      user_id: user.id,
      role: "assistant",
      content: answer,
    });

    // Update chat count
    await supabase
      .from("profiles")
      .update({ chat_count: chatCount + 1 })
      .eq("id", user.id);

    // Auto-title session from first message
    if (session.title === "New Chat" && message.length > 0) {
      const shortTitle = message.slice(0, 40).trim();
      await supabase
        .from("chat_sessions")
        .update({ title: shortTitle })
        .eq("id", sessionId);
    }

    return NextResponse.json({ answer });
  } catch (err) {
    console.error("CHAT ERROR:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}