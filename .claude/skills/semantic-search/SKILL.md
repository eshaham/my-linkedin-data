---
name: semantic-search
description: Search LinkedIn connections by semantic similarity to a query — finds people by role/title (e.g. "product managers", "growth engineers", "designers") or by company type (e.g. "fintech startups", "AI companies"), including variants the user didn't spell out ("PM" finds Senior PMs, Heads of Product, etc.). Use this whenever the user wants to find connections by what they do or where they work, instead of by exact name. Backed by OpenAI embeddings + sqlite-vec stored in linkedin.sqlite.
---

# semantic-search

Find LinkedIn connections by semantic similarity to a natural-language query.

## When to use this skill

Use this skill when the user asks to find connections by:

- **Role / function**: "product managers", "ML engineers", "designers", "founders", "investors", "recruiters".
- **Company type or domain**: "fintech companies", "AI startups", "healthcare orgs", "consulting firms".
- **Seniority phrasing**: "senior PMs", "heads of product", "VPs of engineering".

Do **not** use this skill for:

- Exact name lookups like "find Ben Klinger" — use the `mcp__linkedin-sqlite__query` tool with a `LIKE` clause; faster and no API cost.
- Counting / aggregating / structural queries ("how many connections do I have at X") — use the SQLite MCP server directly.

## How to invoke

The skill is implemented as a Bash command. Run via the Bash tool:

```bash
npm run search -- "<query>" [--kind title|company] [--limit N]
```

Arguments:

- **`<query>`** (required, positional): the natural-language description. Always wrap in quotes.
- **`--kind`**: `title` (default) searches by job title; `company` searches by company name.
- **`--limit`**: number of results, default 20. Bump higher (e.g. 50) when the user wants variety beyond the most exact matches.

Output: a JSON object with `query`, `kind`, `limit`, `count`, and `rows`. Each row has `first_name`, `last_name`, `company`, `position`, `connected_on`, `url`, and `distance` (0 = identical meaning, ~1 = unrelated).

## Examples

User: _"find product managers in my network"_

```bash
npm run search -- "product manager"
```

User: _"who are the senior PMs I know?"_

```bash
npm run search -- "senior product manager" --limit 30
```

User: _"connections at AI startups"_

```bash
npm run search -- "AI startup" --kind company --limit 50
```

## Interpreting results

- Results are sorted by ascending `distance`. Distances under ~0.25 are typically very strong matches; 0.25–0.35 are loosely related; above ~0.4 is noise.
- Multiple connections may share an identical title (e.g. literal "Product Manager" appears many times) — those will cluster at the same distance. If the user wants role _variety_ (Senior PM, Head of Product, Group PM, …), increase `--limit` so the result set extends past the most-exact matches.
- After getting results, summarize for the user — don't dump raw JSON unless they asked for it.

## Costs

Each invocation does one OpenAI `text-embedding-3-small` API call for the query (~$0.00001). All connection vectors are pre-computed at import time, so the per-query cost is negligible.

## Requirements

- `OPENAI_API_KEY` must be set in the project's `.env`.
- `linkedin.sqlite` must exist with embeddings already populated (run `npm run import` first if not).
