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
    "Import enriched LinkedIn profile data (e.g. an Apify actor run dataset) into the connection_positions table. Append-only across runs; re-importing the same URL replaces that URL's prior rows.",
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
    "label stored in connection_positions.source (defaults to 'apify:<adapter>')",
  )
  .action((file: string, options: Options) => {
    const absPath = path.resolve(process.cwd(), file);
    const handle = openDb();
    console.log(`Database: ${DEFAULT_DB_PATH}`);
    try {
      const result = importProfiles(handle.db, absPath, options);
      console.log(
        `Profiles: parsed ${result.recordsParsed}/${result.recordsInFile} records via adapter '${result.adapter}', touched ${result.urlsTouched} URL(s), inserted ${result.positionsInserted} position(s)`,
      );
    } finally {
      handle.close();
    }
  });

program.parse();
