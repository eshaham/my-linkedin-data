import { parse } from "csv-parse/sync";
import fs from "node:fs";
import type { DrizzleDB } from "../db/open.js";
import { connections, importRuns, type NewConnection } from "../db/schema.js";

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

function toRow(raw: RawConnectionRow): NewConnection {
  return {
    firstName: emptyToNull(raw["First Name"]),
    lastName: emptyToNull(raw["Last Name"]),
    url: emptyToNull(raw["URL"]),
    email: emptyToNull(raw["Email Address"]),
    company: emptyToNull(raw["Company"]),
    position: emptyToNull(raw["Position"]),
    connectedOn: normalizeConnectedOn(raw["Connected On"]),
  };
}

export function importConnections(db: DrizzleDB, csvPath: string): number {
  const rawFile = fs.readFileSync(csvPath, "utf8");
  const csv = stripLinkedInPreamble(rawFile);

  const rawRows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as RawConnectionRow[];

  const rows = rawRows.map(toRow);

  db.transaction((tx) => {
    for (const row of rows) {
      if (row.url) {
        tx.insert(connections)
          .values(row)
          .onConflictDoUpdate({
            target: connections.url,
            set: {
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email,
              company: row.company,
              position: row.position,
              connectedOn: row.connectedOn,
            },
          })
          .run();
      } else {
        tx.insert(connections).values(row).run();
      }
    }

    tx.insert(importRuns)
      .values({
        sourceFile: csvPath,
        tableName: "connections",
        rowsImported: rows.length,
      })
      .run();
  });

  return rows.length;
}
