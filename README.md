# my-linkedin-data

Personal tooling to load a LinkedIn data export into a local SQLite database
and query it from Claude Code via the SQLite MCP server.

## Setup

```bash
npm install
cp .env.example .env   # then edit .env and add your OPENAI_API_KEY
```

The `OPENAI_API_KEY` is optional — without it, the importer skips the
embedding step but still loads connections data successfully.

## Importing a LinkedIn export

1. Request your data archive from LinkedIn (Settings → Data Privacy → Get a copy of your data).
2. Unzip it into `data/export/` (the `data/` directory is gitignored).
3. Run the importer:

```bash
npm run import
```

This produces `linkedin.sqlite` in the project root (also gitignored).

`npm run import` loads two CSVs from your export:

| CSV               | Target table  | Strategy                                      |
| ----------------- | ------------- | --------------------------------------------- |
| `Connections.csv` | `connections` | wipe-and-refill                               |
| `Positions.csv`   | `positions`   | wipe-and-refill (your own employment history) |

Each importer truncates and reloads its table inside a transaction, so the
database always reflects exactly what's in the latest export — no duplicates,
removed rows drop out, changed values picked up. The `import_runs` table keeps
an audit log of every run.

## Embeddings

After the connections refill, the importer embeds every **new** unique position
and company string via OpenAI's `text-embedding-3-small` and stores the vectors
in the `embeddings` table (loaded into SQLite via the
[sqlite-vec](https://github.com/asg017/sqlite-vec) extension).

- The `embeddings` table is **append-only** — re-importing never deletes vectors
  and never re-embeds strings already in the table.
- Cost is ~$0.0004 for the first full import (~21k tokens); subsequent imports
  only embed strings that didn't appear in any prior export.
- Without `OPENAI_API_KEY` the embedding step is skipped and the rest of the
  import still succeeds.

## Profile enrichment (work history)

`Connections.csv` only gives you each connection's _current_ company and
title. To detect who you've actually **worked with**, you need each
connection's past positions — which LinkedIn doesn't export to you.

The `connection_positions` table is designed to hold that data, sourced
from a third-party LinkedIn enrichment service (e.g. an
[Apify](https://apify.com) actor). The import script accepts the actor's
JSON output and lands one row per (connection, past position).

```bash
npm run import:profiles -- path/to/apify-dataset.json
```

- A generic Apify-shaped adapter is included (matches common field names
  like `experiences[]`, `companyName`, `title`, `jobStartedOn`/`jobEndedOn`).
  Auto-detected from the file shape; override with `--adapter <name>`.
- Per-URL wipe-and-refill: re-importing a file replaces existing rows for
  each URL in the file. URLs not in the file are left untouched, so partial
  re-enrichment is safe.
- The `connection_positions` table is independent of the
  `Connections.csv` wipe-and-refill, so it survives every regular import.

Once enriched, the "who did I work with?" question is a single join
against your own `positions`:

```sql
SELECT c.first_name, c.last_name, cp.company_name, cp.started_on, cp.finished_on
FROM connection_positions cp
JOIN connections c ON c.url = cp.url
JOIN positions p ON p.company_name = cp.company_name
WHERE (cp.finished_on IS NULL OR cp.finished_on >= p.started_on)
  AND (p.finished_on IS NULL OR p.finished_on >= cp.started_on);
```

## Querying

### Structural queries (counts, lookups by exact field)

Point the [`jparkerweb/mcp-sqlite`](https://github.com/jparkerweb/mcp-sqlite)
server at `linkedin.sqlite` (already configured in `.mcp.json`) and ask Claude
Code things like _"who in my connections works at Anthropic?"_.

### Semantic search (by role or company)

```bash
npm run search -- "product manager"
npm run search -- "AI startup" --kind company --limit 50
```

The script embeds your query with OpenAI, finds the closest pre-embedded
titles or companies via `sqlite-vec`, joins back to `connections`, and prints
a JSON result sorted by ascending semantic distance.

In Claude Code, the `.claude/skills/semantic-search/SKILL.md` skill exposes
this capability — just ask _"find product managers in my network"_ and Claude
will invoke the script automatically.

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
