import { openDb } from "../db/open.js";

function main(): void {
  const sql = process.argv.slice(2).join(" ").trim();
  if (!sql) {
    console.error('Usage: npm run query -- "<SQL>"');
    process.exit(1);
  }

  const db = openDb();
  try {
    const stmt = db.prepare(sql);
    if (stmt.reader) {
      const rows = stmt.all();
      console.log(JSON.stringify(rows, null, 2));
    } else {
      const info = stmt.run();
      console.log(JSON.stringify(info));
    }
  } finally {
    db.close();
  }
}

main();
