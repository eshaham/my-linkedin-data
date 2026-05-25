# my-linkedin-data

Personal tooling to load a LinkedIn data export into a local SQLite database
and query it from Claude Code via the SQLite MCP server.

## Setup

```bash
npm install
```

## Importing a LinkedIn export

1. Request your data archive from LinkedIn (Settings → Data Privacy → Get a copy of your data).
2. Unzip it into `data/export/` (the `data/` directory is gitignored).
3. Run the importer:

```bash
npm run import
```

This produces `linkedin.sqlite` in the project root (also gitignored).

The database is **append-only and immutable**. Each row stores a content hash
of its normalized fields, with a `UNIQUE` constraint on that hash:

- Re-importing the same CSV inserts zero new rows.
- A newer export adds rows for connections that weren't seen before.
- If a connection's company or position changed since the last export, the
  new state is appended as a new row — the prior state is preserved. To get
  the current state, query the most recent row per `url`.
- Rows that _disappear_ from a newer export are kept (immutability). If you
  need to know what was current as of a given run, filter by `import_run_id`.

Every row records the `import_run_id` that introduced it and a `first_seen_at`
timestamp. The `import_runs` table logs every import (rows in the export vs.
rows actually inserted).

## Querying

Querying lives outside this repo. Point the Anthropic SQLite MCP server at
`linkedin.sqlite` and ask Claude Code natural-language questions like _"who in
my connections works at Anthropic?"_.

## Database

The schema is defined in Drizzle ORM at [src/db/schema.ts](src/db/schema.ts).
Migrations live in `drizzle/` and are applied automatically when `openDb()` runs.

When you change the schema:

```bash
npm run db:generate    # diff schema.ts against the latest migration and emit a new one
npm run db:migrate     # apply pending migrations (also runs automatically on openDb)
npm run db:studio      # open Drizzle Studio in a browser to browse the data
```

## Roadmap

- [x] Importer for `Connections.csv`
- [ ] Importers for other useful tables (messages, invitations, positions, education, ...)
- [ ] Optional web UI for visualization
