import { openDb } from "../db/open.js";

function main(): void {
  const sql = process.argv.slice(2).join(" ").trim();
  if (!sql) {
    console.error('Usage: npm run query -- "<SQL>"');
    process.exit(1);
  }

  const handle = openDb();
  try {
    const stmt = handle.sqlite.prepare(sql);
    if (stmt.reader) {
      const rows = stmt.all();
      console.log(JSON.stringify(rows, null, 2));
    } else {
      const info = stmt.run();
      console.log(JSON.stringify(info));
    }
  } finally {
    handle.close();
  }
}

main();
