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

The schema has two layers:

**Layer 1 — raw LinkedIn export (volatile, wipe-and-refill).** Mirrors of the
latest CSVs you imported. Get wiped every `npm run import`.

| CSV               | Target table                   |
| ----------------- | ------------------------------ |
| `Connections.csv` | `linkedin_export_connections`  |
| `Positions.csv`   | `linkedin_export_my_positions` |

**Layer 2 — canonical persistent records (long-term, mutated by Apify).**
Survive every export re-import.

| Table                | Role                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `people`             | one row per LinkedIn person, UUID-keyed; identity matched by `linkedin_urn` → `linkedin_id` → `public_identifier` |
| `person_positions`   | one row per (person, past position); replaced per-person on each enrichment                                       |
| `person_enrichments` | append-only log of every Apify response, full raw JSON archived                                                   |

On every `npm run import`, any new `public_identifier` seen in the export gets a
minimal `people` row (just `first_name`, `last_name`, `public_identifier`). No
`people` row is ever deleted — disconnected connections stay in `people`. Re-import
is wipe-and-refill for Layer 1 only.

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

## Profile enrichment (work history, location, headline, ...)

`Connections.csv` only gives you each connection's _current_ company and
title — no work history, no location, no headline. To get everything else,
the enrichment pipeline ingests JSON dumps from third-party LinkedIn data
providers (e.g. an [Apify](https://apify.com) actor).

### Batch enrichment via the Apify API

The `enrich` command does the round trip automatically — picks which people
to enrich, calls the Apify actor, polls until done, fetches the dataset, and
imports it. Set `APIFY_TOKEN` in `.env` first.

```bash
# defaults: 50 profiles, never-enriched first, then refresh stale (oldest first)
npm run enrich

# bigger batch, just inspect what would run
npm run enrich -- --limit 500 --dry-run

# only re-enrich profiles older than 90 days
npm run enrich -- --limit 100 --mode stale --max-age-days 90
```

`enrich` runs the actor in chunks (default 500 URLs per actor run) using
the async API + polling, so it doesn't get killed by the synchronous
endpoint's 5-minute cap.

### Manual one-off import

If you already have an Apify dataset JSON on disk (downloaded from the
Apify console, for instance), import it directly:

```bash
npm run import:profiles -- path/to/apify-dataset.json
```

For each profile in the JSON file:

- The full raw JSON is archived in `person_enrichments` (insurance against
  ever needing fields we didn't extract).
- Typed scalars (location, headline, current company, country code, …) are
  upserted into `people`, matching the existing row by `linkedin_urn` →
  `linkedin_id` → `public_identifier`. Apify-sourced data wins on conflict.
- `person_positions` rows for that person are replaced atomically with the
  enriched work history.

Adapters live in [`src/importers/profile-adapters/`](src/importers/profile-adapters).
Two ship today:

- `apify:supreme_coder` — the supreme_coder Apify actor's response shape.
- `generic-apify` — best-effort fallback for other Apify actors with similar
  flat shapes.

The right adapter is auto-detected by trial parsing; override with `--adapter`.

Once enriched, the "who did I work with?" question is a single join against
your own positions:

```sql
SELECT p.first_name, p.last_name, pp.company_name, pp.title,
       pp.started_on, pp.finished_on
FROM person_positions pp
JOIN people p ON p.id = pp.person_id
JOIN linkedin_export_my_positions mp ON mp.company_name = pp.company_name
WHERE (pp.finished_on IS NULL OR pp.finished_on >= mp.started_on)
  AND (mp.finished_on IS NULL OR mp.finished_on >= pp.started_on);
```

And "how many connections in Israel?":

```sql
SELECT COUNT(*) FROM people WHERE country_code = 'IL';
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
