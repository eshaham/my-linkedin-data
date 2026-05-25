import fs from "node:fs";
import { parse } from "csv-parse/sync";
import type Database from "better-sqlite3";

interface RawConnectionRow {
  "First Name"?: string;
  "Last Name"?: string;
  URL?: string;
  "Email Address"?: string;
  Company?: string;
  Position?: string;
  "Connected On"?: string;
}

function stripLinkedInPreamble(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const headerIdx = lines.findIndex((line) => line.startsWith("First Name,"));
  if (headerIdx === -1) return raw;
  return lines.slice(headerIdx).join("\n");
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
  return trimmed === "" ? null : trimmed;
}

export function importConnections(
  db: Database.Database,
  csvPath: string,
): number {
  const rawFile = fs.readFileSync(csvPath, "utf8");
  const csv = stripLinkedInPreamble(rawFile);

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as RawConnectionRow[];

  const upsert = db.prepare(`
    INSERT INTO connections (first_name, last_name, url, email, company, position, connected_on)
    VALUES (@first_name, @last_name, @url, @email, @company, @position, @connected_on)
    ON CONFLICT(url) DO UPDATE SET
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      company = excluded.company,
      position = excluded.position,
      connected_on = excluded.connected_on
  `);

  const insertNoUrl = db.prepare(`
    INSERT INTO connections (first_name, last_name, url, email, company, position, connected_on)
    VALUES (@first_name, @last_name, NULL, @email, @company, @position, @connected_on)
  `);

  const tx = db.transaction((items: RawConnectionRow[]) => {
    for (const row of items) {
      const params = {
        first_name: emptyToNull(row["First Name"]),
        last_name: emptyToNull(row["Last Name"]),
        url: emptyToNull(row["URL"]),
        email: emptyToNull(row["Email Address"]),
        company: emptyToNull(row["Company"]),
        position: emptyToNull(row["Position"]),
        connected_on: normalizeConnectedOn(row["Connected On"]),
      };
      if (params.url) upsert.run(params);
      else insertNoUrl.run(params);
    }
  });

  tx(rows);

  db.prepare(
    `INSERT INTO import_runs (source_file, table_name, rows_imported) VALUES (?, ?, ?)`,
  ).run(csvPath, "connections", rows.length);

  return rows.length;
}
