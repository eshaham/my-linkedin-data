import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_DB_PATH, openDb } from '../db/open.js';
import { embedMissing } from '../embeddings/embed-missing.js';
import { importConnections } from '../importers/connections.js';
import { importPositions } from '../importers/positions.js';

const EXPORT_DIR = path.resolve(process.cwd(), 'data', 'export');

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

async function main(): Promise<void> {
  if (!fs.existsSync(EXPORT_DIR)) {
    console.error(`No export directory found at ${EXPORT_DIR}`);
    console.error(`Unzip your LinkedIn data export into that path and re-run.`);
    process.exit(1);
  }

  const handle = openDb();
  console.log(`Database: ${DEFAULT_DB_PATH}`);

  try {
    const connectionsCsv = findFile(EXPORT_DIR, 'Connections.csv');
    if (connectionsCsv) {
      const r = importConnections(handle.db, connectionsCsv);
      const rel = path.relative(process.cwd(), connectionsCsv);
      console.log(
        `Connections: imported ${r.rowsImported} rows from ${rel} (${r.newPeopleCreated} new people created in canonical 'people' table)`,
      );
    } else {
      console.warn(`Connections.csv not found under ${EXPORT_DIR}`);
    }

    const positionsCsv = findFile(EXPORT_DIR, 'Positions.csv');
    if (positionsCsv) {
      const n = importPositions(handle.db, positionsCsv);
      const rel = path.relative(process.cwd(), positionsCsv);
      console.log(`My positions: imported ${n} rows from ${rel}`);
    } else {
      console.warn(`Positions.csv not found under ${EXPORT_DIR}`);
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        'OPENAI_API_KEY not set — skipping embedding step. Add it to .env and re-run to embed new titles/companies.',
      );
    } else {
      const results = await embedMissing(handle.db);
      for (const r of results) {
        if (r.missing === 0) {
          console.log(`Embeddings (${r.kind}): nothing new to embed`);
        } else {
          console.log(
            `Embeddings (${r.kind}): embedded ${r.embedded} new string(s)`,
          );
        }
      }
    }
  } finally {
    handle.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
