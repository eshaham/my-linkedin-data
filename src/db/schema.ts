import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const uuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const linkedinExportConnections = sqliteTable(
  "linkedin_export_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    url: text("url"),
    publicIdentifier: text("public_identifier"),
    email: text("email"),
    company: text("company"),
    position: text("position"),
    connectedOn: text("connected_on"),
  },
  (t) => [
    index("idx_lec_public_identifier").on(t.publicIdentifier),
    index("idx_lec_company").on(t.company),
    index("idx_lec_position").on(t.position),
    index("idx_lec_connected_on").on(t.connectedOn),
  ],
);

export const linkedinExportMyPositions = sqliteTable(
  "linkedin_export_my_positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyName: text("company_name"),
    title: text("title"),
    description: text("description"),
    location: text("location"),
    startedOn: text("started_on"),
    finishedOn: text("finished_on"),
  },
  (t) => [
    index("idx_lemp_company").on(t.companyName),
    index("idx_lemp_started").on(t.startedOn),
  ],
);

export const people = sqliteTable(
  "people",
  {
    id: uuid(),
    linkedinUrn: text("linkedin_urn").unique(),
    linkedinId: text("linkedin_id").unique(),
    publicIdentifier: text("public_identifier").unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    headline: text("headline"),
    jobTitle: text("job_title"),
    summary: text("summary"),
    currentCompanyName: text("current_company_name"),
    currentCompanyPublicId: text("current_company_public_id"),
    currentCompanyLinkedinUrl: text("current_company_linkedin_url"),
    countryCode: text("country_code"),
    geoCountryName: text("geo_country_name"),
    geoLocationName: text("geo_location_name"),
    geoUrn: text("geo_urn"),
    connectionsCount: integer("connections_count"),
    followerCount: integer("follower_count"),
    isVerified: integer("is_verified", { mode: "boolean" }),
    premium: integer("premium", { mode: "boolean" }),
    creator: integer("creator", { mode: "boolean" }),
    influencer: integer("influencer", { mode: "boolean" }),
    connectionType: text("connection_type"),
    pictureUrl: text("picture_url"),
    coverImageUrl: text("cover_image_url"),
    firstSeenAt: text("first_seen_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    lastEnrichedAt: text("last_enriched_at"),
    lastEnrichmentSource: text("last_enrichment_source"),
  },
  (t) => [
    index("idx_people_country").on(t.countryCode),
    index("idx_people_current_company").on(t.currentCompanyName),
  ],
);

export const personPositions = sqliteTable(
  "person_positions",
  {
    id: uuid(),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    title: text("title"),
    locationName: text("location_name"),
    description: text("description"),
    startedOn: text("started_on"),
    finishedOn: text("finished_on"),
    stillWorking: integer("still_working", { mode: "boolean" }),
    source: text("source").notNull(),
    enrichedAt: text("enriched_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_pp_person").on(t.personId),
    index("idx_pp_company").on(t.companyName),
  ],
);

export const personEnrichments = sqliteTable(
  "person_enrichments",
  {
    id: uuid(),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    inputUrl: text("input_url"),
    source: text("source").notNull(),
    rawJson: text("raw_json").notNull(),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_pe_person").on(t.personId)],
);

export const importRuns = sqliteTable("import_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceFile: text("source_file").notNull(),
  tableName: text("table_name").notNull(),
  rowsImported: integer("rows_imported").notNull(),
  importedAt: text("imported_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const embeddings = sqliteTable(
  "embeddings",
  {
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    embedding: blob("embedding").notNull(),
    model: text("model").notNull(),
    embeddedAt: text("embedded_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [primaryKey({ columns: [t.kind, t.text] })],
);

export type LinkedinExportConnection =
  typeof linkedinExportConnections.$inferSelect;
export type NewLinkedinExportConnection =
  typeof linkedinExportConnections.$inferInsert;
export type LinkedinExportMyPosition =
  typeof linkedinExportMyPositions.$inferSelect;
export type NewLinkedinExportMyPosition =
  typeof linkedinExportMyPositions.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type PersonPosition = typeof personPositions.$inferSelect;
export type NewPersonPosition = typeof personPositions.$inferInsert;
export type PersonEnrichment = typeof personEnrichments.$inferSelect;
export type NewPersonEnrichment = typeof personEnrichments.$inferInsert;
export type ImportRun = typeof importRuns.$inferSelect;
export type Embedding = typeof embeddings.$inferSelect;
export type EmbeddingKind = "title" | "company";
