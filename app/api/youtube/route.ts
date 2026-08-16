import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  const videoId = extractVideoId(url);
  if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });

  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = transcriptItems
      .map((item) => item.text)
      .join(" ")
      .replace(/\[.*?\]/g, "")
      .trim();

    if (!transcript || transcript.length < 100) {
      return NextResponse.json({
        error: "No transcript available for this video. Try a video with captions enabled.",
      }, { status: 400 });
    }
    const compressed = transcript
        .replace(/\s+/g, " ")
        .replace(/(.{1,50})\s/g, "$1\n")
        .trim();
    const truncated = transcript.slice(0, 12000);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are a world-class professor and educational content creator. Your job is to transform YouTube video transcripts into the most comprehensive, detailed, and well-structured study notes possible — notes so complete that a student never needs to watch the video again.

LANGUAGE RULE: ALWAYS write in ENGLISH ONLY. No exceptions. Even if the transcript is in Hindi, Bengali, Tamil, Marathi, or any other language — your entire response must be in English.

CONTENT DEPTH RULES:
- Extract and explain EVERY concept, topic, and idea mentioned in the transcript
- If any mathematical formula, equation, or expression is discussed, include it clearly with explanation of each variable
- If any theorem, law, or principle is mentioned, state it fully and explain it
- Include real-world examples and analogies wherever mentioned or applicable
- Each section must have at least 5-7 detailed bullet points
- Each explanation must be 4-6 sentences minimum
- Include step-by-step processes if any procedure is explained
- Note any warnings, common mistakes, or important tips the speaker mentions
- If comparisons are made between concepts, include them explicitly

CRITICAL FORMAT RULE: Respond with RAW JSON ONLY. No markdown. No backticks. No preamble. No explanation. Your response must start with { and end with }

Required JSON structure:
{
  "title": "Clear, descriptive, specific title of the video topic",
  "overview": "A thorough 5-6 sentence paragraph covering: what this video is about, who it is for, what concepts are covered, why these concepts matter, and what the student will be able to do after studying these notes",
  "keyPoints": [
    "Key point 1: [concept name] — detailed explanation of what it is, why it matters, and how it works (2-3 sentences per point)",
    "Include at least 8-10 key points"
  ],
  "sections": [
    {
      "heading": "Specific section topic",
      "content": "Comprehensive 4-6 sentence explanation covering the full depth of this topic including definitions, context, importance, and any nuances mentioned",
      "bullets": [
        "Detailed bullet 1 with full explanation — not just a phrase but a complete thought",
        "Formula/equation if applicable: e.g. F = ma where F is force in Newtons, m is mass in kg, a is acceleration in m/s²",
        "Include at least 5-7 detailed bullets per section"
      ]
    }
  ],
  "formulas": [
    {
      "name": "Formula or equation name",
      "expression": "The formula itself e.g. E = mc²",
      "explanation": "What each variable means and when to use this formula",
      "example": "A worked example if mentioned in the video"
    }
  ],
  "concepts": ["Every key term, concept, and vocabulary word mentioned — include at least 10-15 concepts"],
  "takeaways": [
    "Takeaway 1: specific, actionable, memorable lesson from this video",
    "Include at least 6-8 takeaways"
  ]
}`,
          },
          {
            role: "user",
            content: `Create comprehensive detailed study notes in English from this transcript:\n\n${truncated}`,
          },
        ],
      }),
    });

    if (!groqRes.ok) {
        const errText = await groqRes.text();
        console.error("Groq error:", errText);
        throw new Error("AI generation failed: " + errText);
    }

    const groqData = await groqRes.json();
    const rawContent = groqData.choices?.[0]?.message?.content ?? "{}";

    let notes;
    try {
      const cleaned = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      notes = JSON.parse(cleaned);
    } catch {
      notes = {
        title: "Notes",
        overview: rawContent,
        keyPoints: [],
        sections: [],
        formulas: [],
        concepts: [],
        takeaways: [],
      };
    }

    const { data: saved } = await supabase
      .from("youtube_summaries")
      .insert({
        user_id: user.id,
        url,
        title: notes.title ?? "YouTube Notes",
        summary: notes.overview ?? "",
        key_points: notes,
      })
      .select()
      .single();

    return NextResponse.json({ notes, id: saved?.id });

  } catch (err: any) {
    console.error("YouTube API error:", err);
    return NextResponse.json({ error: err?.message ?? "Failed to process video" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const { data } = await supabase
      .from("youtube_summaries")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ notes: data.key_points, id: data.id });
  }

  const { data } = await supabase
    .from("youtube_summaries")
    .select("id, url, title, created_at, is_pinned")
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ history: data ?? [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, is_pinned } = await request.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (is_pinned !== undefined) updates.is_pinned = is_pinned;

  const { error } = await supabase
    .from("youtube_summaries")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabase
    .from("youtube_summaries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}