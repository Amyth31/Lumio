const JINA_API_KEY = process.env.JINA_API_KEY;

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + JINA_API_KEY,
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",
      input: [text],
      task: "retrieval.query",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Jina embedding error: " + res.status + " " + err);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Jina supports batch — send all at once, much faster
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + JINA_API_KEY,
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",
      input: texts,
      task: "retrieval.passage",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Jina batch embedding error: " + res.status + " " + err);
  }

  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}