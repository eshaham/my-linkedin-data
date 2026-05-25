import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DB_PATH, openDb } from "../db/open.js";
import { importConnections } from "../importers/connections.js";

const EXPORT_DIR = path.resolve(process.cwd(), "data", "export");

function findFile(dir: string, basename: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const direct = path.join(dir, basename);
  if (fs.existsSync(direct)) return direct;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findFile(path.join(dir, entry.name), basename);
      if (found) return found;
    } else if (entry.name === basename) {
      return path.join(dir, entry.name);
    }
  }
  return null;
}

function main(): void {
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`No export directory found at ${EXPORT_DIR}`);
    console.error(`Unzip your LinkedIn data export into that path and re-run.`);
    process.exit(1);
  }

  const handle = openDb();
  console.log(`Database: ${DEFAULT_DB_PATH}`);

  try {
    const connectionsCsv = findFile(EXPORT_DIR, "Connections.csv");
    if (connectionsCsv) {
      const n = importConnections(handle.db, connectionsCsv);
      const rel = path.relative(process.cwd(), connectionsCsv);
      console.log(`Connections: imported ${n} rows from ${rel}`);
    } else {
      console.warn(`Connections.csv not found under ${EXPORT_DIR}`);
    }
  } finally {
    handle.close();
  }
}

main();
