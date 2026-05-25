import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db/open.js";
import { connections, embeddings, type EmbeddingKind } from "../db/schema.js";
import { EMBEDDING_MODEL, embedTexts, vectorToBlob } from "./openai.js";

export interface EmbedResult {
  kind: EmbeddingKind;
  missing: number;
  embedded: number;
}

const COLUMN_BY_KIND = {
  title: connections.position,
  company: connections.company,
} as const;

async function embedKind(
  db: DrizzleDB,
  kind: EmbeddingKind,
): Promise<EmbedResult> {
  const column = COLUMN_BY_KIND[kind];

  const alreadyEmbedded = db
    .select({ text: embeddings.text })
    .from(embeddings)
    .where(eq(embeddings.kind, kind))
    .all()
    .map((r) => r.text);

  const candidates = db
    .selectDistinct({ text: column })
    .from(connections)
    .where(
      alreadyEmbedded.length === 0
        ? isNotNull(column)
        : and(isNotNull(column), notInArray(column, alreadyEmbedded)),
    )
    .all()
    .map((r) => r.text)
    .filter((t): t is string => t !== null);

  if (candidates.length === 0) {
    return { kind, missing: 0, embedded: 0 };
  }

  const vectors = await embedTexts(candidates);

  const rows = candidates.map((text, i) => ({
    kind,
    text,
    embedding: vectorToBlob(vectors[i] ?? []),
    model: EMBEDDING_MODEL,
  }));

  const CHUNK = 200;
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      tx.insert(embeddings)
        .values(rows.slice(i, i + CHUNK))
        .onConflictDoNothing()
        .run();
    }
  });

  return { kind, missing: candidates.length, embedded: rows.length };
}

export async function embedMissing(db: DrizzleDB): Promise<EmbedResult[]> {
  return [await embedKind(db, "title"), await embedKind(db, "company")];
}

export function embeddingStats(db: DrizzleDB): { kind: string; n: number }[] {
  return db
    .select({ kind: embeddings.kind, n: sql<number>`COUNT(*)` })
    .from(embeddings)
    .groupBy(embeddings.kind)
    .all();
}
