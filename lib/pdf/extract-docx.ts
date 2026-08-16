import mammoth from "mammoth";

export async function extractTextFromDocx(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, numPages: 1 };
}