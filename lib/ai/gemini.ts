const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function geminiChat(prompt: string): Promise<string> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
    GEMINI_API_KEY;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Gemini error: " + res.status + " " + err);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}