import type Database from "better-sqlite3";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) VIRTUAL,
  url TEXT UNIQUE,
  email TEXT,
  company TEXT,
  position TEXT,
  connected_on TEXT
);

CREATE INDEX IF NOT EXISTS idx_connections_company ON connections(company);
CREATE INDEX IF NOT EXISTS idx_connections_position ON connections(position);
CREATE INDEX IF NOT EXISTS idx_connections_connected_on ON connections(connected_on);

CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  table_name TEXT NOT NULL,
  rows_imported INTEGER NOT NULL,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export function applySchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}
