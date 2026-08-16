import { createClient } from "@/lib/supabase/server";
import { extractText } from "@/lib/pdf/extract-router";
import { chunkText } from "@/lib/langchain/chunk";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { NextResponse } from "next/server";

function sanitizeText(text: string): string {
  return text
    // Remove null bytes
    .replace(/\x00/g, "")
    // Remove control characters except newline, tab, carriage return
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    // Remove lone surrogates (invalid UTF-16)
    .replace(/[\uD800-\uDFFF]/g, "")
    // Remove Unicode replacement character
    .replace(/\uFFFD/g, "")
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Remove escaped unicode null
    .replace(/\\u0000/g, "")
    // Normalize unicode (handles ligatures, special chars, etc.)
    .normalize("NFKC")
    // Replace multiple spaces with single space
    .replace(/[ \t]+/g, " ")
    // Replace more than 3 consecutive newlines with 2
    .replace(/\n{3,}/g, "\n\n")
    // Trim
    .trim();
}

function sanitizeChunk(content: string): string {
  // Extra safety — remove any remaining problematic chars before DB insert
  return content
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\x80-\uD7FF\uE000-\uFFFD]/g, " ")
    .trim();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await request.json();

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pdfs")
      .download(document.storage_path);

    if (downloadError || !fileData) {
      throw new Error("Failed to download file");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const { text, numPages } = await extractText(buffer, document.file_type || "application/pdf");

    if (!text || text.trim().length === 0) {
      throw new Error("No text could be extracted from this file");
    }

    // Deep sanitization
    const cleanText = sanitizeText(text);

    if (cleanText.length === 0) {
      throw new Error("File appears to contain no readable text");
    }

    const chunks = chunkText(cleanText);

    // Sanitize each chunk individually before embedding
    const sanitizedChunks = chunks.map(sanitizeChunk).filter((c) => c.length > 10);

    if (sanitizedChunks.length === 0) {
      throw new Error("No valid text chunks could be extracted");
    }

    const embeddings = await generateEmbeddings(sanitizedChunks);

    const chunkRows = sanitizedChunks.map((content, i) => ({
      document_id: documentId,
      content,
      embedding: embeddings[i],
      chunk_index: i,
    }));

    // Insert in batches of 50 to avoid payload size issues
    const batchSize = 50;
    for (let i = 0; i < chunkRows.length; i += batchSize) {
      const batch = chunkRows.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("document_chunks")
        .insert(batch);
      if (insertError) throw new Error("Failed to store chunks: " + insertError.message);
    }

    await supabase
      .from("documents")
      .update({ status: "ready", page_count: numPages })
      .eq("id", documentId);

    return NextResponse.json({ success: true, chunksCreated: chunkRows.length });

  } catch (err) {
    console.error("PROCESS ERROR:", err);
    await supabase
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId);

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}