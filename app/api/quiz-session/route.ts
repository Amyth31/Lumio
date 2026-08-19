import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractText } from "@/lib/pdf/extract-router";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const difficulty = (formData.get("difficulty") as string) ?? "mixed";
  const count = parseInt(formData.get("count") as string) || 10;

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

  const context = texts.join("\n\n---\n\n").slice(0, 10000);

  if (!context || context.trim().length < 50) {
    return NextResponse.json({ error: "Could not extract enough content from documents." }, { status: 400 });
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are an expert exam question creator. Create multiple choice questions from the provided content.

LANGUAGE: English only.
DIFFICULTY: ${difficulty === "mixed" ? "Mix of easy, medium, and hard questions" : difficulty + " difficulty only"}.
COUNT: Exactly ${count} questions.

CRITICAL: Respond with RAW JSON ONLY. No markdown. No backticks. No explanation. Start directly with [ and end with ]

[
  {
    "question": "Clear, specific question about the content",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "correct": "A",
    "explanation": "Detailed explanation of why this answer is correct",
    "difficulty": "easy"
  }
]

Rules:
- Questions must be based ONLY on the provided content
- Each option must start with A. B. C. or D. followed by a space
- correct field must be ONLY the letter: A, B, C, or D — nothing else
- Make wrong options plausible
- difficulty field must be: easy, medium, or hard`,
        },
        {
          role: "user",
          content: `Create ${count} MCQ questions from this content:\n\n${context}`,
        },
      ],
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("Groq error:", err);
    return NextResponse.json({ error: "Failed to generate questions. Try again." }, { status: 500 });
  }

  const groqData = await groqRes.json();
  const rawContent = groqData.choices?.[0]?.message?.content ?? "";

  console.log("Groq raw response (first 300):", rawContent.slice(0, 300));

  let questions;
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const arrayStart = cleaned.indexOf("[");
    const arrayEnd = cleaned.lastIndexOf("]");

    if (arrayStart === -1 || arrayEnd === -1) {
      console.error("No JSON array found:", cleaned.slice(0, 300));
      return NextResponse.json({ error: "AI returned invalid format. Please try again." }, { status: 500 });
    }

    const jsonStr = cleaned.slice(arrayStart, arrayEnd + 1);
    questions = JSON.parse(jsonStr);

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "No questions generated. Try again." }, { status: 500 });
    }
  } catch (parseErr) {
    console.error("Parse error:", parseErr);
    return NextResponse.json({ error: "Failed to parse questions. Please try again." }, { status: 500 });
  }

  const { data: saved } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: user.id,
      document_id: null,
      score: 0,
      total: questions.length,
      time_taken: 0,
    })
    .select()
    .single();

  return NextResponse.json({ questions, attemptId: saved?.id });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId, score, time_taken } = await request.json();
  if (!attemptId) return NextResponse.json({ error: "Attempt ID required" }, { status: 400 });

  const { error } = await supabase
    .from("quiz_attempts")
    .update({ score, time_taken })
    .eq("id", attemptId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("quiz_attempts")
    .select("*, documents(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ attempts: data ?? [] });
}