import { type SQL, and, asc, isNotNull, isNull, sql } from 'drizzle-orm';

import type { DrizzleDB } from '../db/open.js';
import {
  linkedinExportConnections,
  linkedinExportMyPositions,
  people,
} from '../db/schema.js';

export type SelectionMode = 'missing-then-stale' | 'missing' | 'stale';

export type SelectionFilter = 'all' | 'at-my-companies';

export interface SelectedUrl {
  personId: string;
  publicIdentifier: string;
  url: string;
  lastEnrichedAt: string | null;
}

function buildUrl(publicIdentifier: string): string {
  return `https://www.linkedin.com/in/${encodeURI(publicIdentifier)}`;
}

/**
 * Returns the distinct, lowercased, non-null company names from the user's
 * own LinkedIn-export positions. Used by the at-my-companies filter.
 */
export function getMyCompaniesLowercased(db: DrizzleDB): string[] {
  const rows = db
    .selectDistinct({ companyName: linkedinExportMyPositions.companyName })
    .from(linkedinExportMyPositions)
    .where(isNotNull(linkedinExportMyPositions.companyName))
    .all();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.companyName) continue;
    const lc = r.companyName.trim().toLowerCase();
    if (lc === '' || seen.has(lc)) continue;
    seen.add(lc);
    out.push(lc);
  }
  return out;
}

function filterClause(
  filter: SelectionFilter,
  db: DrizzleDB,
): SQL | null {
  if (filter === 'all') return null;
  if (filter === 'at-my-companies') {
    const myCompanies = getMyCompaniesLowercased(db);
    if (myCompanies.length === 0) return sql`1 = 0`;
    const inList = sql.join(
      myCompanies.map((c) => sql`${c}`),
      sql`, `,
    );
    return sql`EXISTS (
      SELECT 1 FROM ${linkedinExportConnections} lec
      WHERE lec.public_identifier = ${people.publicIdentifier}
        AND lec.company IS NOT NULL
        AND LOWER(lec.company) IN (${inList})
    )`;
  }
  const _exhaustive: never = filter;
  return _exhaustive;
}

export function selectUrlsToEnrich(
  db: DrizzleDB,
  options: {
    limit: number;
    mode?: SelectionMode;
    maxAgeDays?: number;
    filter?: SelectionFilter;
  },
): SelectedUrl[] {
  const mode = options.mode ?? 'missing-then-stale';
  const filter = options.filter ?? 'all';
  const limit = options.limit;
  const out: SelectedUrl[] = [];

  const filterExpr = filterClause(filter, db);

  if (mode === 'missing' || mode === 'missing-then-stale') {
    const baseWhere = isNull(people.lastEnrichedAt);
    const where = filterExpr ? and(baseWhere, filterExpr) : baseWhere;
    const missing = db
      .select({
        id: people.id,
        publicIdentifier: people.publicIdentifier,
        lastEnrichedAt: people.lastEnrichedAt,
      })
      .from(people)
      .where(where)
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
    (mode === 'stale' || mode === 'missing-then-stale')
  ) {
    const remaining = limit - out.length;
    const cutoff =
      options.maxAgeDays !== undefined
        ? sql`datetime('now', ${`-${options.maxAgeDays} days`})`
        : null;
    const baseWhere = cutoff
      ? sql`${people.lastEnrichedAt} IS NOT NULL AND ${people.lastEnrichedAt} < ${cutoff}`
      : isNotNull(people.lastEnrichedAt);
    const where = filterExpr ? and(baseWhere, filterExpr) : baseWhere;
    const stale = db
      .select({
        id: people.id,
        publicIdentifier: people.publicIdentifier,
        lastEnrichedAt: people.lastEnrichedAt,
      })
      .from(people)
      .where(where)
      .orderBy(asc(people.lastEnrichedAt))
      .limit(remaining)
      .all();
    for (const r of stale) {
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
