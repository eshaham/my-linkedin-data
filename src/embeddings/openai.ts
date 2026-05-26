import OpenAI from 'openai';

export const EMBEDDING_MODEL = 'text-embedding-3-small';

const BATCH_SIZE = 500;

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!cachedClient) cachedClient = new OpenAI();
  return cachedClient;
}

export function vectorToBlob(values: number[]): Buffer {
  const f32 = new Float32Array(values);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getClient();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    for (const item of res.data) out.push(item.embedding);
  }
  return out;
}
