import { Command } from "commander";
import path from "node:path";
import { DEFAULT_DB_PATH, openDb } from "../db/open.js";
import { ADAPTERS } from "../importers/profile-adapters/adapters.js";
import { importProfiles } from "../importers/profiles.js";

interface Options {
  adapter?: string;
  source?: string;
}

const program = new Command();

program
  .name("import-profiles")
  .description(
    "Import enriched LinkedIn profile data (e.g. an Apify actor run dataset). Upserts canonical 'people' rows (matched by linkedin_urn / linkedin_id / public_identifier), archives the full raw JSON in person_enrichments, and replaces person_positions per person.",
  )
  .argument(
    "<file>",
    "path to a JSON or JSONL file of profile records (e.g. Apify dataset export)",
  )
  .option(
    "-a, --adapter <name>",
    `parser to use; one of: ${ADAPTERS.map((a) => a.name).join(", ")}. Auto-detected from the file if omitted.`,
  )
  .option(
    "-s, --source <label>",
    "label stored in person_positions.source / person_enrichments.source (defaults to the adapter name)",
  )
  .action((file: string, options: Options) => {
    const absPath = path.resolve(process.cwd(), file);
    const handle = openDb();
    console.log(`Database: ${DEFAULT_DB_PATH}`);
    try {
      const result = importProfiles(handle.db, absPath, options);
      console.log(
        `Profiles: parsed ${result.recordsParsed}/${result.recordsInFile} via '${result.adapter}', upserted ${result.peopleUpserted} people (${result.peopleCreated} new), inserted ${result.positionsInserted} position(s), logged ${result.enrichmentsLogged} enrichment(s)`,
      );
    } finally {
      handle.close();
    }
  });

program.parse();
