import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query?.trim()) {
    return NextResponse.json({ results: [] });
  }

  // Get all user's document IDs
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, status")
    .eq("user_id", user.id)
    .eq("status", "ready");

  if (!docs || docs.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const docIds = docs.map((d) => d.id);
  const embedding = await generateEmbedding(query);

  const { data: chunks } = await supabase.rpc("match_chunks_multi", {
    query_embedding: embedding,
    match_document_ids: docIds,
    match_count: 8,
  });

  // Group by document
  const docMap = Object.fromEntries(docs.map((d) => [d.id, d.title]));
  const grouped: Record<string, { title: string; chunks: string[] }> = {};

  for (const chunk of chunks ?? []) {
    const docId = chunk.document_id;
    if (!grouped[docId]) {
      grouped[docId] = { title: docMap[docId] ?? "Unknown", chunks: [] };
    }
    if (grouped[docId].chunks.length < 2) {
      grouped[docId].chunks.push(chunk.content.slice(0, 200) + "...");
    }
  }

  return NextResponse.json({ results: Object.entries(grouped).map(([id, val]) => ({ documentId: id, ...val })) });
}