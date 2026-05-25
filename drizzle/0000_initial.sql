CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text,
	`last_name` text,
	`url` text,
	`email` text,
	`company` text,
	`position` text,
	`connected_on` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_url_unique` ON `connections` (`url`);--> statement-breakpoint
CREATE INDEX `idx_connections_company` ON `connections` (`company`);--> statement-breakpoint
CREATE INDEX `idx_connections_position` ON `connections` (`position`);--> statement-breakpoint
CREATE INDEX `idx_connections_connected_on` ON `connections` (`connected_on`);--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_file` text NOT NULL,
	`table_name` text NOT NULL,
	`rows_imported` integer NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
