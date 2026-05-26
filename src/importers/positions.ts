import { parse } from 'csv-parse/sync';
import fs from 'node:fs';

import type { DrizzleDB } from '../db/open.js';
import {
  type NewLinkedinExportMyPosition,
  importRuns,
  linkedinExportMyPositions,
} from '../db/schema.js';

interface RawPositionRow {
  'Company Name'?: string;
  Title?: string;
  Description?: string;
  Location?: string;
  'Started On'?: string;
  'Finished On'?: string;
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeDate(value: string | undefined): string | null {
  const trimmed = emptyToNull(value);
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function toRow(raw: RawPositionRow): NewLinkedinExportMyPosition {
  return {
    companyName: emptyToNull(raw['Company Name']),
    title: emptyToNull(raw.Title),
    description: emptyToNull(raw.Description),
    location: emptyToNull(raw.Location),
    startedOn: normalizeDate(raw['Started On']),
    finishedOn: normalizeDate(raw['Finished On']),
  };
}

export function importPositions(db: DrizzleDB, csvPath: string): number {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = (
    parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as RawPositionRow[]
  ).map(toRow);

  db.transaction((tx) => {
    tx.delete(linkedinExportMyPositions).run();
    if (rows.length > 0)
      tx.insert(linkedinExportMyPositions).values(rows).run();
    tx.insert(importRuns)
      .values({
        sourceFile: csvPath,
        tableName: 'linkedin_export_my_positions',
        rowsImported: rows.length,
      })
      .run();
  });

  return rows.length;
}
