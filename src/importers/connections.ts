import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';

import type { DrizzleDB } from '../db/open.js';
import {
  type NewLinkedinExportConnection,
  importRuns,
  linkedinExportConnections,
  people,
} from '../db/schema.js';
import { extractPublicIdentifier } from '../lib/linkedin-url.js';

interface RawConnectionRow {
  'First Name'?: string;
  'Last Name'?: string;
  URL?: string;
  'Email Address'?: string;
  Company?: string;
  Position?: string;
  'Connected On'?: string;
}

export interface ImportConnectionsResult {
  rowsImported: number;
  newPeopleCreated: number;
}

function stripLinkedInPreamble(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const headerIdx = lines.findIndex((line) =>
    line.replace(/^﻿/, '').trimStart().startsWith('First Name,'),
  );
  if (headerIdx === -1) return raw;
  return lines.slice(headerIdx).join('\n');
}

function normalizeConnectedOn(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString().slice(0, 10);
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toRow(raw: RawConnectionRow): NewLinkedinExportConnection {
  const url = emptyToNull(raw.URL);
  return {
    firstName: emptyToNull(raw['First Name']),
    lastName: emptyToNull(raw['Last Name']),
    url,
    publicIdentifier: extractPublicIdentifier(url),
    email: emptyToNull(raw['Email Address']),
    company: emptyToNull(raw.Company),
    position: emptyToNull(raw.Position),
    connectedOn: normalizeConnectedOn(raw['Connected On']),
  };
}

const INSERT_CHUNK_SIZE = 500;

export function importConnections(
  db: DrizzleDB,
  csvPath: string,
): ImportConnectionsResult {
  const rawFile = fs.readFileSync(csvPath, 'utf8');
  const csv = stripLinkedInPreamble(rawFile);
  const rows = (
    parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as RawConnectionRow[]
  ).map(toRow);

  let newPeopleCreated = 0;

  db.transaction((tx) => {
    tx.delete(linkedinExportConnections).run();

    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
      if (chunk.length > 0) {
        tx.insert(linkedinExportConnections).values(chunk).run();
      }
    }

    const distinctPublicIdsInExport = new Set<string>();
    for (const r of rows) {
      if (r.publicIdentifier) distinctPublicIdsInExport.add(r.publicIdentifier);
    }

    const existingPids = new Set(
      tx
        .select({ publicIdentifier: people.publicIdentifier })
        .from(people)
        .all()
        .map((p) => p.publicIdentifier)
        .filter((p): p is string => p !== null),
    );

    const peopleInserts: {
      publicId: string;
      firstName: string | null;
      lastName: string | null;
    }[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r.publicIdentifier) continue;
      if (existingPids.has(r.publicIdentifier)) continue;
      if (seen.has(r.publicIdentifier)) continue;
      seen.add(r.publicIdentifier);
      peopleInserts.push({
        publicId: r.publicIdentifier,
        firstName: r.firstName ?? null,
        lastName: r.lastName ?? null,
      });
    }

    if (peopleInserts.length > 0) {
      for (let i = 0; i < peopleInserts.length; i += INSERT_CHUNK_SIZE) {
        const chunk = peopleInserts.slice(i, i + INSERT_CHUNK_SIZE);
        tx.insert(people)
          .values(
            chunk.map((p) => ({
              publicIdentifier: p.publicId,
              firstName: p.firstName,
              lastName: p.lastName,
            })),
          )
          .onConflictDoNothing({ target: people.publicIdentifier })
          .run();
      }
      newPeopleCreated = peopleInserts.length;
    }

    tx.insert(importRuns)
      .values({
        sourceFile: csvPath,
        tableName: 'linkedin_export_connections',
        rowsImported: rows.length,
      })
      .run();
  });

  return { rowsImported: rows.length, newPeopleCreated };
}
