import { Command, InvalidArgumentError } from 'commander';
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { openDb } from '../db/open.js';
import {
  type SelectionFilter,
  type SelectionMode,
  getMyCompaniesLowercased,
  selectUrlsToEnrich,
} from '../enrichment/select-urls.js';
import { importProfiles } from '../importers/profiles.js';
import {
  fetchDatasetItems,
  startActorRun,
  waitForRun,
} from '../lib/apify-client.js';

const DEFAULT_ACTOR = 'supreme_coder~linkedin-profile-scraper';
const DEFAULT_ADAPTER = 'apify:supreme_coder';
const DEFAULT_CHUNK_SIZE = 500;

interface Options {
  limit: number;
  mode: SelectionMode;
  filter: SelectionFilter;
  actor: string;
  adapter: string;
  chunkSize: number;
  maxAgeDays?: number;
  dryRun: boolean;
}

function parsePositiveInt(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError('must be a positive integer');
  }
  return n;
}

function parseMode(value: string): SelectionMode {
  if (
    value !== 'missing' &&
    value !== 'stale' &&
    value !== 'missing-then-stale'
  ) {
    throw new InvalidArgumentError(
      "must be 'missing', 'stale', or 'missing-then-stale'",
    );
  }
  return value;
}

function parseFilter(value: string): SelectionFilter {
  if (value !== 'all' && value !== 'at-my-companies') {
    throw new InvalidArgumentError("must be 'all' or 'at-my-companies'");
  }
  return value;
}

async function runEnrichment(options: Options): Promise<void> {
  const handle = openDb();
  try {
    if (options.filter === 'at-my-companies') {
      const myCompanies = getMyCompaniesLowercased(handle.db);
      if (myCompanies.length === 0) {
        console.error(
          "Filter 'at-my-companies' is active but no rows found in linkedin_export_my_positions. Run `npm run import` first.",
        );
        process.exit(1);
      }
      console.log(
        `Filter 'at-my-companies' is active. Matching connections currently at any of:\n  ${myCompanies.join(', ')}`,
      );
    }

    const targets = selectUrlsToEnrich(handle.db, {
      limit: options.limit,
      mode: options.mode,
      maxAgeDays: options.maxAgeDays,
      filter: options.filter,
    });

    if (targets.length === 0) {
      console.log('Nothing to enrich — no matching people in the database.');
      return;
    }

    const buckets = targets.reduce(
      (acc, t) => {
        if (t.lastEnrichedAt === null) acc.missing++;
        else acc.stale++;
        return acc;
      },
      { missing: 0, stale: 0 },
    );
    console.log(
      `Selected ${targets.length} target(s): ${buckets.missing} never-enriched + ${buckets.stale} stale (oldest first).`,
    );

    if (options.dryRun) {
      console.log('--dry-run: not running the actor. First 5 targets:');
      for (const t of targets.slice(0, 5)) {
        console.log(
          `  ${t.publicIdentifier}  (last_enriched_at=${t.lastEnrichedAt ?? 'never'})`,
        );
      }
      return;
    }

    if (!process.env.APIFY_TOKEN) {
      console.error(
        'APIFY_TOKEN not set in env. Run `plugga setup apify --account personal` or add it to .env, then re-run.',
      );
      process.exit(1);
    }

    const chunks: (typeof targets)[] = [];
    for (let i = 0; i < targets.length; i += options.chunkSize) {
      chunks.push(targets.slice(i, i + options.chunkSize));
    }

    let totalUpserted = 0;
    let totalCreated = 0;
    let totalPositions = 0;
    let chunkNum = 0;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apify-enrich-'));

    for (const chunk of chunks) {
      chunkNum++;
      const chunkLabel = `chunk ${chunkNum}/${chunks.length} (${chunk.length} URL(s))`;
      console.log(`\n[${chunkLabel}] starting actor run...`);

      const run = await startActorRun(options.actor, {
        urls: chunk.map((t) => ({ url: t.url })),
      });
      console.log(`[${chunkLabel}] runId=${run.runId} status=${run.status}`);

      const finished = await waitForRun(run.runId, {
        pollIntervalMs: 5_000,
        timeoutMs: 30 * 60_000,
        onTick: (r) => {
          if (r.status !== 'RUNNING' && r.status !== 'READY') {
            console.log(`[${chunkLabel}] status=${r.status}`);
          }
        },
      });

      if (finished.status !== 'SUCCEEDED') {
        console.error(
          `[${chunkLabel}] run did not succeed (status=${finished.status}). Stopping.`,
        );
        break;
      }
      if (!finished.datasetId) {
        console.error(`[${chunkLabel}] no datasetId — skipping.`);
        continue;
      }

      const items = await fetchDatasetItems(finished.datasetId);
      console.log(
        `[${chunkLabel}] fetched ${items.length} item(s) from dataset`,
      );

      const tmpFile = path.join(tmpDir, `chunk-${chunkNum}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify(items));

      const result = importProfiles(handle.db, tmpFile, {
        adapter: options.adapter,
        source: options.adapter,
      });
      console.log(
        `[${chunkLabel}] imported: ${result.peopleUpserted} people (${result.peopleCreated} new), ${result.positionsInserted} positions, ${result.enrichmentsLogged} enrichment(s) archived`,
      );
      totalUpserted += result.peopleUpserted;
      totalCreated += result.peopleCreated;
      totalPositions += result.positionsInserted;
    }

    console.log(
      `\nDone. Total: ${totalUpserted} people upserted (${totalCreated} new), ${totalPositions} positions inserted across ${chunkNum} chunk(s).`,
    );
    console.log(`Intermediate JSON files kept at ${tmpDir} for inspection.`);
  } finally {
    handle.close();
  }
}

const program = new Command();

program
  .name('enrich')
  .description(
    'Run an Apify LinkedIn-profile-scraper actor against people in our database, prioritising never-enriched profiles, then refreshing stale ones (oldest last_enriched_at first).',
  )
  .option(
    '-n, --limit <n>',
    'max profiles to enrich in this run',
    parsePositiveInt,
    50,
  )
  .option(
    '-m, --mode <mode>',
    "selection: 'missing' (only never-enriched), 'stale' (only previously-enriched), or 'missing-then-stale'",
    parseMode,
    'missing-then-stale' as SelectionMode,
  )
  .option(
    '-f, --filter <filter>',
    "scope: 'all' (default) or 'at-my-companies' (only connections currently at one of your past employers, per Positions.csv)",
    parseFilter,
    'all' as SelectionFilter,
  )
  .option(
    '--max-age-days <n>',
    'when selecting stale rows, only refresh those last enriched more than N days ago',
    parsePositiveInt,
  )
  .option(
    '--actor <id>',
    'Apify actor id (tilde-separated, e.g. user~actor)',
    DEFAULT_ACTOR,
  )
  .option(
    '--adapter <name>',
    "adapter to use when importing the actor's output",
    DEFAULT_ADAPTER,
  )
  .option(
    '--chunk-size <n>',
    'max URLs per actor run',
    parsePositiveInt,
    DEFAULT_CHUNK_SIZE,
  )
  .option(
    '--dry-run',
    'print the selected targets without calling Apify',
    false,
  )
  .action(async (options: Options) => {
    await runEnrichment(options);
  });

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
