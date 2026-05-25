import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const importRuns = sqliteTable("import_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceFile: text("source_file").notNull(),
  tableName: text("table_name").notNull(),
  rowsInExport: integer("rows_in_export").notNull(),
  rowsInserted: integer("rows_inserted").notNull(),
  importedAt: text("imported_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const connections = sqliteTable(
  "connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    rowHash: text("row_hash").notNull().unique(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    url: text("url"),
    email: text("email"),
    company: text("company"),
    position: text("position"),
    connectedOn: text("connected_on"),
    importRunId: integer("import_run_id")
      .notNull()
      .references(() => importRuns.id),
    firstSeenAt: text("first_seen_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_connections_url").on(t.url),
    index("idx_connections_company").on(t.company),
    index("idx_connections_position").on(t.position),
    index("idx_connections_connected_on").on(t.connectedOn),
  ],
);

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type ImportRun = typeof importRuns.$inferSelect;
