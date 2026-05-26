import { asc, isNotNull, isNull, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db/open.js";
import { people } from "../db/schema.js";

export type SelectionMode = "missing-then-stale" | "missing" | "stale";

export interface SelectedUrl {
  personId: string;
  publicIdentifier: string;
  url: string;
  lastEnrichedAt: string | null;
}

function buildUrl(publicIdentifier: string): string {
  return `https://www.linkedin.com/in/${encodeURI(publicIdentifier)}`;
}

export function selectUrlsToEnrich(
  db: DrizzleDB,
  options: {
    limit: number;
    mode?: SelectionMode;
    maxAgeDays?: number;
  },
): SelectedUrl[] {
  const mode = options.mode ?? "missing-then-stale";
  const limit = options.limit;
  const out: SelectedUrl[] = [];

  if (mode === "missing" || mode === "missing-then-stale") {
    const missing = db
      .select({
        id: people.id,
        publicIdentifier: people.publicIdentifier,
        lastEnrichedAt: people.lastEnrichedAt,
      })
      .from(people)
      .where(isNull(people.lastEnrichedAt))
      .orderBy(asc(people.firstSeenAt))
      .limit(limit)
      .all();
    for (const r of missing) {
      if (!r.publicIdentifier) continue;
      out.push({
        personId: r.id,
        publicIdentifier: r.publicIdentifier,
        url: buildUrl(r.publicIdentifier),
        lastEnrichedAt: r.lastEnrichedAt,
      });
    }
  }

  if (
    out.length < limit &&
    (mode === "stale" || mode === "missing-then-stale")
  ) {
    const remaining = limit - out.length;
    const cutoff =
      options.maxAgeDays !== undefined
        ? sql`datetime('now', ${`-${options.maxAgeDays} days`})`
        : null;
    let q = db
      .select({
        id: people.id,
        publicIdentifier: people.publicIdentifier,
        lastEnrichedAt: people.lastEnrichedAt,
      })
      .from(people)
      .where(
        cutoff
          ? sql`${people.lastEnrichedAt} IS NOT NULL AND ${people.lastEnrichedAt} < ${cutoff}`
          : isNotNull(people.lastEnrichedAt),
      )
      .orderBy(asc(people.lastEnrichedAt))
      .limit(remaining)
      .all();
    for (const r of q) {
      if (!r.publicIdentifier) continue;
      out.push({
        personId: r.id,
        publicIdentifier: r.publicIdentifier,
        url: buildUrl(r.publicIdentifier),
        lastEnrichedAt: r.lastEnrichedAt,
      });
    }
  }

  return out;
}
