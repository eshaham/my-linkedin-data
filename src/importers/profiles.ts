import { eq, or } from "drizzle-orm";
import fs from "node:fs";
import type { DrizzleDB } from "../db/open.js";
import {
  people,
  personEnrichments,
  personPositions,
  type NewPerson,
  type NewPersonPosition,
} from "../db/schema.js";
import { ADAPTERS } from "./profile-adapters/adapters.js";
import type {
  ProfileAdapter,
  ProfileRecord,
} from "./profile-adapters/types.js";

export interface ImportProfilesResult {
  recordsInFile: number;
  recordsParsed: number;
  peopleUpserted: number;
  peopleCreated: number;
  positionsInserted: number;
  enrichmentsLogged: number;
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
      const p = adapter.parse(r);
      if (p && (p.linkedinUrn || p.linkedinId || p.publicIdentifier)) hits++;
    }
    if (hits > bestHits) {
      best = adapter;
      bestHits = hits;
    }
  }
  return best;
}

function profileToPeopleColumns(profile: ProfileRecord): Partial<NewPerson> {
  return {
    linkedinUrn: profile.linkedinUrn,
    linkedinId: profile.linkedinId,
    publicIdentifier: profile.publicIdentifier,
    firstName: profile.firstName,
    lastName: profile.lastName,
    headline: profile.headline,
    jobTitle: profile.jobTitle,
    summary: profile.summary,
    currentCompanyName: profile.currentCompanyName,
    currentCompanyPublicId: profile.currentCompanyPublicId,
    currentCompanyLinkedinUrl: profile.currentCompanyLinkedinUrl,
    countryCode: profile.countryCode,
    geoCountryName: profile.geoCountryName,
    geoLocationName: profile.geoLocationName,
    geoUrn: profile.geoUrn,
    connectionsCount: profile.connectionsCount,
    followerCount: profile.followerCount,
    isVerified: profile.isVerified,
    premium: profile.premium,
    creator: profile.creator,
    influencer: profile.influencer,
    connectionType: profile.connectionType,
    pictureUrl: profile.pictureUrl,
    coverImageUrl: profile.coverImageUrl,
  };
}

function findPersonId(db: DrizzleDB, profile: ProfileRecord): string | null {
  const filters = [];
  if (profile.linkedinUrn)
    filters.push(eq(people.linkedinUrn, profile.linkedinUrn));
  if (profile.linkedinId)
    filters.push(eq(people.linkedinId, profile.linkedinId));
  if (profile.publicIdentifier)
    filters.push(eq(people.publicIdentifier, profile.publicIdentifier));
  if (filters.length === 0) return null;
  const whereExpr = filters.length === 1 ? filters[0]! : or(...filters)!;
  const row = db.select({ id: people.id }).from(people).where(whereExpr).get();
  return row?.id ?? null;
}

export function importProfiles(
  db: DrizzleDB,
  filePath: string,
  options: { adapter?: string; source?: string } = {},
): ImportProfilesResult {
  const records = readInput(filePath);
  const adapter = pickAdapter(records, options.adapter);
  const source = options.source ?? adapter.name;

  const parsed: ProfileRecord[] = [];
  for (const r of records) {
    const rec = adapter.parse(r);
    if (rec && (rec.linkedinUrn || rec.linkedinId || rec.publicIdentifier)) {
      parsed.push(rec);
    }
  }

  let peopleCreated = 0;
  let peopleUpserted = 0;
  let positionsInserted = 0;
  let enrichmentsLogged = 0;
  const now = new Date().toISOString();

  db.transaction((tx) => {
    for (const profile of parsed) {
      const existingId = findPersonId(tx as unknown as DrizzleDB, profile);
      const cols = profileToPeopleColumns(profile);
      let personId: string;

      if (existingId) {
        const updates: Partial<NewPerson> = {
          ...cols,
          lastEnrichedAt: now,
          lastEnrichmentSource: source,
        };
        for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
          if (updates[key] === null || updates[key] === undefined) {
            delete updates[key];
          }
        }
        tx.update(people).set(updates).where(eq(people.id, existingId)).run();
        personId = existingId;
      } else {
        const inserted = tx
          .insert(people)
          .values({
            ...cols,
            lastEnrichedAt: now,
            lastEnrichmentSource: source,
          })
          .returning({ id: people.id })
          .all();
        const insertedRow = inserted[0];
        if (!insertedRow) {
          throw new Error("Failed to insert person row");
        }
        personId = insertedRow.id;
        peopleCreated++;
      }
      peopleUpserted++;

      tx.insert(personEnrichments)
        .values({
          personId,
          inputUrl: profile.inputUrl,
          source,
          rawJson: JSON.stringify(profile.raw),
        })
        .run();
      enrichmentsLogged++;

      tx.delete(personPositions)
        .where(eq(personPositions.personId, personId))
        .run();

      if (profile.positions.length > 0) {
        const rows: NewPersonPosition[] = profile.positions.map((pos) => ({
          personId,
          companyName: pos.companyName,
          title: pos.title,
          locationName: pos.locationName,
          description: pos.description,
          startedOn: pos.startedOn,
          finishedOn: pos.finishedOn,
          stillWorking: pos.stillWorking,
          source,
        }));
        tx.insert(personPositions).values(rows).run();
        positionsInserted += rows.length;
      }
    }
  });

  return {
    recordsInFile: records.length,
    recordsParsed: parsed.length,
    peopleUpserted,
    peopleCreated,
    positionsInserted,
    enrichmentsLogged,
    adapter: adapter.name,
  };
}
