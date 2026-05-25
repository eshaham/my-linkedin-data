import Database from "better-sqlite3";
import path from "node:path";
import { applySchema } from "./schema.js";

export const DEFAULT_DB_PATH = path.resolve(process.cwd(), "linkedin.sqlite");

export function openDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}
