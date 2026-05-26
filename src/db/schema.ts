import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const connections = sqliteTable(
  "connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    url: text("url"),
    email: text("email"),
    company: text("company"),
    position: text("position"),
    connectedOn: text("connected_on"),
  },
  (t) => [
    index("idx_connections_url").on(t.url),
    index("idx_connections_company").on(t.company),
    index("idx_connections_position").on(t.position),
    index("idx_connections_connected_on").on(t.connectedOn),
  ],
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

export const positions = sqliteTable(
  "positions",
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
    index("idx_positions_company").on(t.companyName),
    index("idx_positions_started").on(t.startedOn),
  ],
);

export const connectionPositions = sqliteTable(
  "connection_positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    url: text("url").notNull(),
    companyName: text("company_name").notNull(),
    title: text("title"),
    startedOn: text("started_on"),
    finishedOn: text("finished_on"),
    stillWorking: integer("still_working", { mode: "boolean" }),
    source: text("source").notNull(),
    enrichedAt: text("enriched_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_cp_url").on(t.url),
    index("idx_cp_company").on(t.companyName),
  ],
);

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type ImportRun = typeof importRuns.$inferSelect;
export type Embedding = typeof embeddings.$inferSelect;
export type EmbeddingKind = "title" | "company";
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type ConnectionPosition = typeof connectionPositions.$inferSelect;
export type NewConnectionPosition = typeof connectionPositions.$inferInsert;
