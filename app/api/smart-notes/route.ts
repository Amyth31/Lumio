import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractText } from "@/lib/pdf/extract-router";

async function generateWithGemini(prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const files = [
    ...formData.getAll("files") as File[],
    ...formData.getAll("file") as File[],
  ].filter(Boolean);

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  let text = "";
  let title = "";

  try {
    const file = files[0];
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractText(buffer, file.type);
    text = result.text;
    title = file.name.replace(/\.(pdf|docx|pptx|txt|md|csv|xlsx)$/i, "");
  } catch (err) {
    console.error("Text extraction error:", err);
    return NextResponse.json({ error: "Could not extract text from this file" }, { status: 400 });
  }

  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: "Could not extract enough text from this file" }, { status: 400 });
  }

  const truncated = text.slice(0, 4000);

  const systemPrompt = `You are an expert academic note-taker. Convert the provided document content into comprehensive, well-structured study notes.

LANGUAGE: ALWAYS respond in ENGLISH ONLY regardless of the document language.

CRITICAL FORMAT RULE: Respond with RAW JSON ONLY. No markdown. No backticks. Start with { end with }

{
  "title": "Document topic title",
  "summary": "3-4 sentence executive summary of the entire document",
  "sections": [
    {
      "heading": "Section heading",
      "content": "3-4 sentence detailed explanation",
      "bullets": ["detailed bullet 1", "detailed bullet 2", "at least 4-5 bullets"],
      "formulas": [
        {
          "expression": "formula here",
          "explanation": "what it means"
        }
      ]
    }
  ],
  "definitions": [
    {
      "term": "Key term",
      "definition": "Clear definition"
    }
  ],
  "keyFormulas": [
    {
      "name": "Formula name",
      "expression": "formula",
      "explanation": "explanation with variables"
    }
  ],
  "concepts": ["concept1", "concept2"],
  "summary_points": ["important point 1", "important point 2", "at least 5-6 points"]
}`;

  const userMessage = `Create detailed structured study notes from this document:\n\nTitle: ${title}\n\n${truncated}`;

  let rawContent: string | null = null;

  // Try Groq first
  try {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      rawContent = groqData.choices?.[0]?.message?.content ?? null;
      console.log("Groq success");
    } else {
      const errText = await groqRes.text();
      console.warn("Groq failed, trying Gemini:", errText);
    }
  } catch (err) {
    console.warn("Groq error, trying Gemini:", err);
  }

  // Gemini fallback
  if (!rawContent) {
    console.log("Using Gemini fallback...");
    rawContent = await generateWithGemini(`${systemPrompt}\n\n${userMessage}`);
  }

  if (!rawContent) {
    return NextResponse.json({ error: "AI generation failed. Try a smaller document." }, { status: 500 });
  }

  let notes;
  try {
    const cleaned = rawContent
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const objStart = cleaned.indexOf("{");
    const objEnd = cleaned.lastIndexOf("}");
    if (objStart === -1 || objEnd === -1) throw new Error("No JSON object found");

    notes = JSON.parse(cleaned.slice(objStart, objEnd + 1));
  } catch (err) {
    console.error("Parse error:", err);
    notes = {
      title,
      summary: rawContent.slice(0, 500),
      sections: [],
      definitions: [],
      keyFormulas: [],
      concepts: [],
      summary_points: [],
    };
  }

  const { data: saved } = await supabase
    .from("smart_notes")
    .insert({
      user_id: user.id,
      document_id: null,
      content: JSON.stringify(notes),
    })
    .select()
    .single();

  return NextResponse.json({ notes, id: saved?.id, title });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const { data } = await supabase
      .from("smart_notes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ notes: JSON.parse(data.content), id: data.id });
  }

  const { data } = await supabase
    .from("smart_notes")
    .select("id, content, created_at, is_pinned")
    .eq("user_id", user.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const history = (data ?? []).map((item) => {
    try {
      const parsed = JSON.parse(item.content);
      return { id: item.id, title: parsed.title ?? "Untitled", created_at: item.created_at, is_pinned: item.is_pinned };
    } catch {
      return { id: item.id, title: "Untitled", created_at: item.created_at, is_pinned: item.is_pinned };
    }
  });

  return NextResponse.json({ history });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_pinned } = await request.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const { error } = await supabase
    .from("smart_notes")
    .update({ is_pinned })
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
    .from("smart_notes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}