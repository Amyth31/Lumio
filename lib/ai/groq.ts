const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function groqChat(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[] = [],
  model = "llama-3.3-70b-versatile"
): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + GROQ_API_KEY,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Groq error: " + res.status + " " + err);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}