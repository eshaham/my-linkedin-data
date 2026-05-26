import Database from 'better-sqlite3';
import {
  type BetterSQLite3Database,
  drizzle,
} from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as sqliteVec from 'sqlite-vec';

import * as schema from './schema.js';

export const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'linkedin.sqlite');
export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'drizzle');

export type Schema = typeof schema;
export type DrizzleDB = BetterSQLite3Database<Schema>;

export interface DbHandle {
  db: DrizzleDB;
  sqlite: Database.Database;
  close: () => void;
}

export function openDb(dbPath: string = DEFAULT_DB_PATH): DbHandle {
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  try {
    sqliteVec.load(sqlite);
  } catch (err) {
    console.warn(
      `sqlite-vec failed to load — vector functions (vec_distance_cosine, vec_f32) will be unavailable. Imports without embedding will still work. Error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
