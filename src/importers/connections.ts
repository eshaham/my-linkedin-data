import { sql } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import crypto from "node:crypto";
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

export interface ImportResult {
  rowsInExport: number;
  rowsInserted: number;
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

function computeRowHash(fields: Array<string | null>): string {
  const payload = fields.map((v) => v ?? "").join("\x1f");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function toRow(raw: RawConnectionRow, importRunId: number): NewConnection {
  const firstName = emptyToNull(raw["First Name"]);
  const lastName = emptyToNull(raw["Last Name"]);
  const url = emptyToNull(raw["URL"]);
  const email = emptyToNull(raw["Email Address"]);
  const company = emptyToNull(raw["Company"]);
  const position = emptyToNull(raw["Position"]);
  const connectedOn = normalizeConnectedOn(raw["Connected On"]);
  const rowHash = computeRowHash([
    firstName,
    lastName,
    url,
    email,
    company,
    position,
    connectedOn,
  ]);
  return {
    rowHash,
    firstName,
    lastName,
    url,
    email,
    company,
    position,
    connectedOn,
    importRunId,
  };
}

const INSERT_CHUNK_SIZE = 500;

export function importConnections(
  db: DrizzleDB,
  csvPath: string,
): ImportResult {
  const rawFile = fs.readFileSync(csvPath, "utf8");
  const csv = stripLinkedInPreamble(rawFile);

  const rawRows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as RawConnectionRow[];

  return db.transaction((tx) => {
    const [run] = tx
      .insert(importRuns)
      .values({
        sourceFile: csvPath,
        tableName: "connections",
        rowsInExport: rawRows.length,
        rowsInserted: 0,
      })
      .returning({ id: importRuns.id })
      .all();

    if (!run) throw new Error("Failed to create import_runs row");

    const rows = rawRows.map((r) => toRow(r, run.id));

    let inserted = 0;
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE);
      if (chunk.length === 0) continue;
      const info = tx
        .insert(connections)
        .values(chunk)
        .onConflictDoNothing({ target: connections.rowHash })
        .run();
      inserted += Number(info.changes);
    }

    tx.update(importRuns)
      .set({ rowsInserted: inserted })
      .where(sql`id = ${run.id}`)
      .run();

    return { rowsInExport: rawRows.length, rowsInserted: inserted };
  });
}
