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

Re-importing is **wipe-and-refill** for the `connections` table: each importer
truncates and reloads from the CSV inside a transaction, so the database always
reflects exactly what's in the latest export — no duplicates, removed
connections drop out, changed companies/positions are picked up. The
`import_runs` table keeps an audit log of every run.

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

Find connections whose position is semantically similar to a query — note
`vec_distance_cosine` and `vec_f32` come from the sqlite-vec extension:

```sql
WITH q AS (SELECT vec_f32('[...query vector here...]') AS v)
SELECT c.first_name, c.last_name, c.company, c.position,
       vec_distance_cosine(e.embedding, q.v) AS distance
FROM connections c
JOIN embeddings e ON e.kind = 'title' AND e.text = c.position
CROSS JOIN q
ORDER BY distance ASC
LIMIT 20;
```

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
