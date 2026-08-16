import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import { execSync } from "child_process";

const GS_PATH = "C:\\Program Files\\gs\\gs10.07.1\\bin\\gswin64c.exe";

export async function extractTextFromPdf(buffer: Buffer): Promise<{
  text: string;
  numPages: number;
}> {
  const uint8Array = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8Array);
  const { text, totalPages } = await unpdfExtractText(pdf, { mergePages: true });

  if (text && text.trim().length > 50) {
    return { text, numPages: totalPages };
  }

  console.log("Image-based PDF detected, using Groq Vision OCR...");

  const os = await import("os");
  const path = await import("path");
  const fs = await import("fs");

  const tmpDir = os.tmpdir();
  const outputDir = path.join(tmpDir, `lumio_${Date.now()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  // PDF buffer ko temp file mein save karo
  const pdfPath = path.join(outputDir, "input.pdf");
  fs.writeFileSync(pdfPath, buffer);

  let fullText = "";

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const outPath = path.join(outputDir, `page_${pageNum}.jpg`);

      try {
        // Ghostscript directly use karo PDF → JPEG
        const gsCmd = `"${GS_PATH}" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=jpeg -r150 -dFirstPage=${pageNum} -dLastPage=${pageNum} -sOutputFile="${outPath}" "${pdfPath}"`;
        execSync(gsCmd, { stdio: "pipe" });

        if (!fs.existsSync(outPath)) {
          console.log(`Page ${pageNum}: output file not created`);
          continue;
        }

        const fileBuffer = fs.readFileSync(outPath);
        const base64 = fileBuffer.toString("base64");
        const sizeKB = Math.round(base64.length / 1024);
        console.log(`Page ${pageNum}: size = ${sizeKB}KB`);

        if (sizeKB === 0) continue;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract ALL text from this image exactly as it appears. Include all numbers, tables, headings, and content. Do not summarize — output the raw text only.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:image/jpeg;base64,${base64}`,
                    },
                  },
                ],
              },
            ],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const pageText = data.choices?.[0]?.message?.content ?? "";
          console.log(`Page ${pageNum}: extracted ${pageText.length} chars`);
          fullText += `--- Page ${pageNum} ---\n${pageText}\n\n`;
        } else {
          const errText = await res.text();
          console.error(`Page ${pageNum}: Groq error:`, errText);
        }

      } catch (innerErr: any) {
        console.error(`Page ${pageNum} error:`, innerErr?.message ?? innerErr);
      }
    }

  } finally {
    try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch {}
  }

  if (fullText.trim().length > 0) {
    return { text: fullText.trim(), numPages: totalPages };
  }

  throw new Error(
    "This PDF is image-based and could not be processed. Try uploading a text-based PDF or a .txt file."
  );
}