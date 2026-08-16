import JSZip from "jszip";

export async function extractTextFromPptx(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  let fullText = "";
  for (const fileName of slideFiles) {
    const xml = await zip.files[fileName].async("string");
    const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
    const slideText = matches.map((m) => m.replace(/<a:t>|<\/a:t>/g, "")).join(" ");
    fullText += slideText + "\n\n";
  }

  return { text: fullText, numPages: slideFiles.length };
}