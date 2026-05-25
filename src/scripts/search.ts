import "dotenv/config";
import { Command, InvalidArgumentError } from "commander";
import OpenAI from "openai";
import { openDb } from "../db/open.js";
import { EMBEDDING_MODEL, vectorToBlob } from "../embeddings/openai.js";

type Kind = "title" | "company";

interface Options {
  kind: Kind;
  limit: number;
}

function parsePositiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return n;
}

function parseKind(value: string): Kind {
  if (value !== "title" && value !== "company") {
    throw new InvalidArgumentError("must be 'title' or 'company'");
  }
  return value;
}

async function runSearch(query: string, options: Options): Promise<void> {
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

    const joinCol = options.kind === "title" ? "position" : "company";
    const sql = `
      SELECT c.first_name, c.last_name, c.company, c.position,
             c.connected_on, c.url,
             ROUND(vec_distance_cosine(e.embedding, ?), 4) AS distance
      FROM connections c
      JOIN embeddings e ON e.kind = ? AND e.text = c.${joinCol}
      ORDER BY distance ASC
      LIMIT ?
    `;
    const rows = handle.sqlite
      .prepare(sql)
      .all(queryBlob, options.kind, options.limit);

    console.log(
      JSON.stringify(
        {
          query,
          kind: options.kind,
          limit: options.limit,
          count: rows.length,
          rows,
        },
        null,
        2,
      ),
    );
  } finally {
    handle.close();
  }
}

const program = new Command();

program
  .name("search")
  .description(
    "Semantic search over LinkedIn connections by title or company embedding.",
  )
  .argument("<query>", "natural-language query to embed and search")
  .option(
    "-k, --kind <kind>",
    "which embedding to search: 'title' or 'company'",
    parseKind,
    "title" as Kind,
  )
  .option("-l, --limit <n>", "maximum number of results", parsePositiveInt, 20)
  .action(async (query: string, options: Options) => {
    await runSearch(query, options);
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
