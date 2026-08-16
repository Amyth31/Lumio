import { groqChat, ChatMessage } from "./groq";
import { geminiChat } from "./gemini";

export async function aiChat(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  const enhancedSystem =
    systemPrompt +
    "\n\nIMPORTANT: Always respond in English only, regardless of the language of the question.";

  try {
    return await groqChat(enhancedSystem, userMessage, history);
  } catch (err) {
    console.warn("Groq failed, falling back to Gemini:", err);

    // Gemini doesn't take a structured messages array here, so we
    // flatten the history into a plain transcript before the current question.
    const historyText = history
      .map((m) => (m.role === "user" ? "User: " : "Assistant: ") + m.content)
      .join("\n");

    const fullPrompt =
      enhancedSystem +
      (historyText ? "\n\nConversation so far:\n" + historyText : "") +
      "\n\nUser: " +
      userMessage;

    return await geminiChat(fullPrompt);
  }
}