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

## Querying

### From Claude Code (SQLite MCP)

Configure the SQLite MCP server to point at `linkedin.sqlite`, then ask Claude
Code natural-language questions like _"who in my connections works at Anthropic?"_.

### Typed search via Drizzle ORM

```bash
npm run search:connections -- --company Lemonade --position Engineer --limit 10
npm run search:connections -- --name Smith
```

### Raw SQL escape hatch

```bash
npm run query -- "SELECT COUNT(*) FROM connections"
```

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
