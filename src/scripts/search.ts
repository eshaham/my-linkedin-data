import "dotenv/config";
import OpenAI from "openai";
import { openDb } from "../db/open.js";
import { EMBEDDING_MODEL, vectorToBlob } from "../embeddings/openai.js";

type Kind = "title" | "company";

interface Args {
  query: string;
  kind: Kind;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  let kind: Kind = "title";
  let limit = 20;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--kind") {
      const next = argv[++i];
      if (next !== "title" && next !== "company") {
        throw new Error(`--kind must be 'title' or 'company', got '${next}'`);
      }
      kind = next;
    } else if (a === "--limit") {
      const next = argv[++i];
      const n = Number(next);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--limit must be a positive number, got '${next}'`);
      }
      limit = n;
    } else if (a !== undefined) {
      positional.push(a);
    }
  }
  if (positional.length === 0) {
    throw new Error(
      `Usage: npm run search -- "<query>" [--kind title|company] [--limit N]`,
    );
  }
  return { query: positional.join(" "), kind, limit };
}

async function main(): Promise<void> {
  const { query, kind, limit } = parseArgs(process.argv.slice(2));

  if (!process.env.OPENAI_API_KEY) {
    console.error(
      "OPENAI_API_KEY not set in .env — cannot embed the query. Add it and re-run.",
    );
    process.exit(1);
  }

  const handle = openDb();
  try {
    const res = await new OpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
    });
    const embedding = res.data[0]?.embedding;
    if (!embedding) throw new Error("OpenAI returned no embedding for query");
    const queryBlob = vectorToBlob(embedding);

    const joinCol = kind === "title" ? "position" : "company";
    const sql = `
      SELECT c.first_name, c.last_name, c.company, c.position,
             c.connected_on, c.url,
             ROUND(vec_distance_cosine(e.embedding, ?), 4) AS distance
      FROM connections c
      JOIN embeddings e ON e.kind = ? AND e.text = c.${joinCol}
      ORDER BY distance ASC
      LIMIT ?
    `;
    const rows = handle.sqlite.prepare(sql).all(queryBlob, kind, limit);

    console.log(
      JSON.stringify({ query, kind, limit, count: rows.length, rows }, null, 2),
    );
  } finally {
    handle.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
