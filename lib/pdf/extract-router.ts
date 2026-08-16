import { extractTextFromPdf } from "./extract-pdfs";
import { extractTextFromDocx } from "./extract-docx";
import { extractTextFromPptx } from "./extract-pptx";

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; numPages: number }> {

  if (mimeType === "application/pdf") {
    return extractTextFromPdf(buffer);
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractTextFromDocx(buffer);
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return extractTextFromPptx(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let text = "";
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      text += `Sheet: ${sheetName}\n`;
      text += XLSX.utils.sheet_to_csv(sheet) + "\n\n";
    }
    return { text: text.trim(), numPages: workbook.SheetNames.length };
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    mimeType === "text/x-markdown"
  ) {
    const text = buffer.toString("utf-8");
    return { text, numPages: 1 };
  }

  throw new Error("Unsupported file type: " + mimeType);
}

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
];

export const ACCEPTED_EXTENSIONS = ".pdf,.docx,.pptx,.xlsx,.xls,.txt,.md,.csv";