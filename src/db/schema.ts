import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const connections = sqliteTable(
  "connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    url: text("url").unique(),
    email: text("email"),
    company: text("company"),
    position: text("position"),
    connectedOn: text("connected_on"),
  },
  (t) => [
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

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
