import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import * as schema from "./schema.js";

export const DEFAULT_DB_PATH = path.resolve(process.cwd(), "linkedin.sqlite");
export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

export type Schema = typeof schema;
export type DrizzleDB = BetterSQLite3Database<Schema>;

export interface DbHandle {
  db: DrizzleDB;
  sqlite: Database.Database;
  close: () => void;
}

export function openDb(dbPath: string = DEFAULT_DB_PATH): DbHandle {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
