import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractText } from "@/lib/pdf/extract-router";
import { YoutubeTranscript } from "youtube-transcript";
import { randomUUID } from "crypto";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    /(?:youtube\.com\/live\/)([^&\n?#?]+)/,
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].split("?")[0];
  }
  return null;
}

// ---- SM-2 update ----
type Quality = "again" | "hard" | "good" | "easy";

function applySM2(
  quality: Quality,
  prev: { ease_factor: number; interval_days: number; repetitions: number } | null
) {
  const ease_factor = prev?.ease_factor ?? 2.5;
  const interval_days = prev?.interval_days ?? 0;
  const repetitions = prev?.repetitions ?? 0;

  let newEase = ease_factor;
  let newInterval: number;
  let newReps: number;

  if (quality === "again") {
    newReps = 0;
    newInterval = 1;
    newEase = Math.max(1.3, ease_factor - 0.2);
  } else {
    newReps = repetitions + 1;
    if (quality === "hard") {
      newEase = Math.max(1.3, ease_factor - 0.15);
      newInterval = Math.max(1, Math.round(interval_days * 1.2)) || 1;
    } else if (quality === "good") {
      newInterval =
        newReps === 1 ? 1 : newReps === 2 ? 6 : Math.round(interval_days * ease_factor);
    } else {
      // easy
      newEase = ease_factor + 0.15;
      newInterval =
        newReps === 1 ? 2 : Math.round((interval_days || 1) * ease_factor * 1.3);
    }
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    ease_factor: newEase,
    interval_days: newInterval,
    repetitions: newReps,
    next_review: nextReview.toISOString(),
    last_reviewed: new Date().toISOString(),
  };
}

// Walks the text and pulls out every balanced {...} object, respecting
// strings/escapes so braces inside quoted text don't confuse the depth count.
function extractBalancedObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

// Tries a straight JSON.parse first. If the model truncated the response
// (hit max_tokens) or mangled one card with a stray backslash/quote, this
// salvages every individually-valid {question, answer} object instead of
// failing the whole batch over one bad card.
function safeParseFlashcards(cleaned: string): { question: string; answer: string }[] {
  const arrayStart = cleaned.indexOf("[");
  if (arrayStart === -1) {
    throw new Error("AI returned invalid format. Please try again.");
  }
  const arrayEnd = cleaned.lastIndexOf("]");
  const jsonStr = arrayEnd !== -1 ? cleaned.slice(arrayStart, arrayEnd + 1) : cleaned.slice(arrayStart);

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter(
        (c) => c && typeof c.question === "string" && typeof c.answer === "string"
      );
    }
  } catch {
    // fall through to salvage mode
  }

  const cards: { question: string; answer: string }[] = [];
  for (const objStr of extractBalancedObjects(jsonStr)) {
    try {
      const parsed = JSON.parse(objStr);
      if (parsed && typeof parsed.question === "string" && typeof parsed.answer === "string") {
        cards.push({ question: parsed.question, answer: parsed.answer });
      }
    } catch {
      // skip this one malformed card, keep the rest
    }
  }

  if (cards.length === 0) {
    throw new Error("AI returned invalid format. Please try again.");
  }
  return cards;
}

async function generateFlashcards(context: string, count: number) {
  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8000,
      messages: [
        {
          role: "system",
          content: `You are an expert study-flashcard creator. Create concise active-recall flashcards from the provided content.

LANGUAGE: English only.
COUNT: Exactly ${count} flashcards.

CRITICAL: Respond with RAW JSON ONLY. No markdown. No backticks. No explanation. Start directly with [ and end with ]

[
  {
    "question": "Short, specific question or prompt testing one concept",
    "answer": "Clear, complete answer — 1-3 sentences"
  }
]

JSON FORMATTING RULES (strict):
- Valid JSON only. Every string must use double quotes, and any double quote or backslash INSIDE a string must be escaped (\\" and \\\\).
- Do not use LaTeX or raw backslash math notation (e.g. \\partial, \\frac). Write formulas in plain text instead, e.g. "dJ/dw", "partial derivative of J with respect to w".
- No trailing commas.
- No comments, no markdown fences, no text before [ or after ].

CONTENT RULES:
- Each card tests exactly ONE concept (atomic)
- Questions should force active recall, not just definition lookup
- Cover the breadth of the content, prioritizing the most important concepts
- No duplicate or near-duplicate cards`,
        },
        {
          role: "user",
          content: `Create ${count} flashcards from this content:\n\n${context}`,
        },
      ],
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("Groq error:", err);
    throw new Error("Failed to generate flashcards. Try again.");
  }

  const groqData = await groqRes.json();
  const rawContent = groqData.choices?.[0]?.message?.content ?? "";

  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const cards = safeParseFlashcards(cleaned);

  if (!cards || cards.length === 0) {
    throw new Error("No flashcards generated. Try again.");
  }

  return cards;
}

// ---- POST: generate a new batch (document upload OR youtube url) ----
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const sourceType = (formData.get("sourceType") as string) ?? "document";
  const count = parseInt(formData.get("count") as string) || 15;

  let context = "";
  let sourceTitle = "";

  try {
    if (sourceType === "youtube") {
      const url = formData.get("youtubeUrl") as string;
      if (!url) return NextResponse.json({ error: "YouTube URL required" }, { status: 400 });

      const videoId = extractVideoId(url);
      if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
      const transcript = transcriptItems
        .map((item) => item.text)
        .join(" ")
        .replace(/\[.*?\]/g, "")
        .trim();

      if (!transcript || transcript.length < 100) {
        return NextResponse.json(
          { error: "No transcript available for this video. Try a video with captions enabled." },
          { status: 400 }
        );
      }

      context = transcript.slice(0, 12000);
      sourceTitle = `YouTube: ${url}`;
    } else {
      const files = formData.getAll("files") as File[];
      if (!files || files.length === 0) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
      }

      const texts: string[] = [];
      for (const file of files) {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const result = await extractText(buffer, file.type);
          if (result.text) texts.push(`[${file.name}]\n${result.text}`);
        } catch (err) {
          console.error(`Failed to extract text from ${file.name}:`, err);
        }
      }

      context = texts.join("\n\n---\n\n").slice(0, 10000);
      sourceTitle = files.map((f) => f.name).join(", ");

      if (!context || context.trim().length < 50) {
        return NextResponse.json(
          { error: "Could not extract enough content from documents." },
          { status: 400 }
        );
      }
    }

    const cards = await generateFlashcards(context, count);
    const batchId = randomUUID();

    const { data: saved, error: insertErr } = await supabase
      .from("flashcards")
      .insert(
        cards.map((c) => ({
          document_id: null,
          user_id: user.id,
          batch_id: batchId,
          source_type: sourceType,
          source_title: sourceTitle,
          question: c.question,
          answer: c.answer,
        }))
      )
      .select();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ flashcards: saved, batchId, sourceTitle });
  } catch (err) {
    console.error("FLASHCARDS-LEARN ERROR:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate flashcards" },
      { status: 500 }
    );
  }
}

type BatchInfo = {
  batchId: string;
  sourceType: string;
  sourceTitle: string;
  createdAt: string;
  count: number;
};

// ---- GET: list batches (history) OR fetch one batch's cards + review state ----
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const batchId = url.searchParams.get("batchId");

  if (batchId) {
    const { data: cards, error } = await supabase
      .from("flashcards")
      .select("*")
      .eq("user_id", user.id)
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const cardIds = cards.map((c) => c.id);
    const { data: reviews } = await supabase
      .from("flashcard_reviews")
      .select("*")
      .eq("user_id", user.id)
      .in("flashcard_id", cardIds);

    const reviewMap = new Map((reviews ?? []).map((r) => [r.flashcard_id, r]));
    const merged = cards.map((c) => ({ ...c, review: reviewMap.get(c.id) ?? null }));

    return NextResponse.json({ flashcards: merged, batchId });
  }

  // List batches, grouped in JS since supabase-js has no simple GROUP BY
  const { data: rows, error } = await supabase
    .from("flashcards")
    .select("batch_id, source_type, source_title, created_at")
    .eq("user_id", user.id)
    .not("batch_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const batches = new Map<string, BatchInfo>();

  for (const row of rows ?? []) {
    const existing = batches.get(row.batch_id);
    if (existing) {
      existing.count += 1;
    } else {
      batches.set(row.batch_id, {
        batchId: row.batch_id,
        sourceType: row.source_type,
        sourceTitle: row.source_title,
        createdAt: row.created_at,
        count: 1,
      });
    }
  }

  return NextResponse.json({ batches: Array.from(batches.values()).slice(0, 30) });
}

// ---- PATCH: submit a review for one card (SM-2 update) ----
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { flashcardId, quality } = await request.json();
  if (!flashcardId || !quality) {
    return NextResponse.json({ error: "flashcardId and quality required" }, { status: 400 });
  }
  if (!["again", "hard", "good", "easy"].includes(quality)) {
    return NextResponse.json({ error: "Invalid quality value" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("flashcard_reviews")
    .select("*")
    .eq("user_id", user.id)
    .eq("flashcard_id", flashcardId)
    .maybeSingle();

  const updated = applySM2(quality as Quality, existing);

  const { data: saved, error } = await supabase
    .from("flashcard_reviews")
    .upsert(
      {
        user_id: user.id,
        flashcard_id: flashcardId,
        ...updated,
      },
      { onConflict: "user_id,flashcard_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: saved });
}

// ---- DELETE: remove a whole batch ----
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { batchId } = await request.json();
  if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

  const { data: cards } = await supabase
    .from("flashcards")
    .select("id")
    .eq("user_id", user.id)
    .eq("batch_id", batchId);

  const cardIds = (cards ?? []).map((c) => c.id);
  if (cardIds.length > 0) {
    await supabase.from("flashcard_reviews").delete().eq("user_id", user.id).in("flashcard_id", cardIds);
  }

  const { error } = await supabase
    .from("flashcards")
    .delete()
    .eq("user_id", user.id)
    .eq("batch_id", batchId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}