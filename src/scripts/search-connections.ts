import { and, like, or, type SQL } from "drizzle-orm";
import { openDb } from "../db/open.js";
import { connections } from "../db/schema.js";

interface Args {
  name?: string;
  company?: string;
  position?: string;
  limit: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 50 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--name":
        args.name = next;
        i++;
        break;
      case "--company":
        args.company = next;
        i++;
        break;
      case "--position":
        args.position = next;
        i++;
        break;
      case "--limit":
        if (next) args.limit = Number(next);
        i++;
        break;
    }
  }
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const handle = openDb();

  try {
    const filters: SQL[] = [];
    if (args.name) {
      const pattern = `%${args.name}%`;
      const nameFilter = or(
        like(connections.firstName, pattern),
        like(connections.lastName, pattern),
      );
      if (nameFilter) filters.push(nameFilter);
    }
    if (args.company)
      filters.push(like(connections.company, `%${args.company}%`));
    if (args.position)
      filters.push(like(connections.position, `%${args.position}%`));

    const where = filters.length > 0 ? and(...filters) : undefined;

    const rows = handle.db
      .select({
        firstName: connections.firstName,
        lastName: connections.lastName,
        company: connections.company,
        position: connections.position,
        connectedOn: connections.connectedOn,
        url: connections.url,
      })
      .from(connections)
      .where(where)
      .limit(args.limit)
      .all();

    console.log(JSON.stringify(rows, null, 2));
    console.log(`\n${rows.length} result(s)`);
  } finally {
    handle.close();
  }
}

main();
