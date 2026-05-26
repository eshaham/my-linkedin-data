import { inArray } from "drizzle-orm";
import fs from "node:fs";
import type { DrizzleDB } from "../db/open.js";
import {
  connectionPositions,
  type NewConnectionPosition,
} from "../db/schema.js";
import { ADAPTERS } from "./profile-adapters/adapters.js";
import type {
  ProfileAdapter,
  ProfileRecord,
} from "./profile-adapters/types.js";

export interface ImportProfilesResult {
  recordsInFile: number;
  recordsParsed: number;
  urlsTouched: number;
  positionsInserted: number;
  adapter: string;
}

function readInput(filePath: string): unknown[] {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (raw === "") return [];
  if (raw.startsWith("[")) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`Top-level JSON must be an array, got ${typeof parsed}`);
    }
    return parsed;
  }
  return raw
    .split(/\n+/)
    .filter((line) => line.trim() !== "")
    .map((line, idx) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(
          `Failed to parse JSONL line ${idx + 1}: ${err instanceof Error ? err.message : err}`,
        );
      }
    });
}

function pickAdapter(records: unknown[], explicit?: string): ProfileAdapter {
  if (explicit) {
    const found = ADAPTERS.find((a) => a.name === explicit);
    if (!found) {
      throw new Error(
        `Unknown adapter '${explicit}'. Available: ${ADAPTERS.map((a) => a.name).join(", ")}`,
      );
    }
    return found;
  }
  let best = ADAPTERS[0]!;
  let bestHits = -1;
  for (const adapter of ADAPTERS) {
    let hits = 0;
    for (const r of records.slice(0, 20)) {
      if (adapter.parse(r)) hits++;
    }
    if (hits > bestHits) {
      best = adapter;
      bestHits = hits;
    }
  }
  return best;
}

export function importProfiles(
  db: DrizzleDB,
  filePath: string,
  options: { adapter?: string; source?: string } = {},
): ImportProfilesResult {
  const records = readInput(filePath);
  const adapter = pickAdapter(records, options.adapter);
  const source = options.source ?? `apify:${adapter.name}`;

  const parsed: ProfileRecord[] = [];
  for (const r of records) {
    const rec = adapter.parse(r);
    if (rec) parsed.push(rec);
  }

  const urls = Array.from(new Set(parsed.map((p) => p.url)));

  const rows: NewConnectionPosition[] = [];
  for (const rec of parsed) {
    for (const pos of rec.positions) {
      rows.push({
        url: rec.url,
        companyName: pos.companyName,
        title: pos.title,
        startedOn: pos.startedOn,
        finishedOn: pos.finishedOn,
        stillWorking: pos.stillWorking ?? null,
        source,
      });
    }
  }

  db.transaction((tx) => {
    if (urls.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < urls.length; i += CHUNK) {
        const chunk = urls.slice(i, i + CHUNK);
        tx.delete(connectionPositions)
          .where(inArray(connectionPositions.url, chunk))
          .run();
      }
    }
    if (rows.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        tx.insert(connectionPositions)
          .values(rows.slice(i, i + CHUNK))
          .run();
      }
    }
  });

  return {
    recordsInFile: records.length,
    recordsParsed: parsed.length,
    urlsTouched: urls.length,
    positionsInserted: rows.length,
    adapter: adapter.name,
  };
}
