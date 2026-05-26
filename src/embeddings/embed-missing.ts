import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db/open.js";
import {
  embeddings,
  linkedinExportConnections,
  type EmbeddingKind,
} from "../db/schema.js";
import { EMBEDDING_MODEL, embedTexts, vectorToBlob } from "./openai.js";

export interface EmbedResult {
  kind: EmbeddingKind;
  missing: number;
  embedded: number;
}

const COLUMN_BY_KIND = {
  title: linkedinExportConnections.position,
  company: linkedinExportConnections.company,
} as const;

async function embedKind(
  db: DrizzleDB,
  kind: EmbeddingKind,
): Promise<EmbedResult> {
  const column = COLUMN_BY_KIND[kind];

  const candidates = db
    .selectDistinct({ text: column })
    .from(linkedinExportConnections)
    .leftJoin(
      embeddings,
      and(eq(embeddings.kind, kind), eq(embeddings.text, column)),
    )
    .where(and(isNotNull(column), isNull(embeddings.text)))
    .all()
    .map((r) => r.text)
    .filter((t): t is string => t !== null);

  if (candidates.length === 0) {
    return { kind, missing: 0, embedded: 0 };
  }

  const vectors = await embedTexts(candidates);

  if (vectors.length !== candidates.length) {
    throw new Error(
      `Embedding count mismatch for kind=${kind}: got ${vectors.length} vectors for ${candidates.length} inputs`,
    );
  }
  for (let i = 0; i < vectors.length; i++) {
    if (!vectors[i] || vectors[i]!.length === 0) {
      throw new Error(
        `Empty embedding returned for kind=${kind} at index ${i} (text="${candidates[i]}")`,
      );
    }
  }

  const rows = candidates.map((text, i) => ({
    kind,
    text,
    embedding: vectorToBlob(vectors[i]!),
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
