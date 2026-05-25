CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`row_hash` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`url` text,
	`email` text,
	`company` text,
	`position` text,
	`connected_on` text,
	`import_run_id` integer NOT NULL,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connections_row_hash_unique` ON `connections` (`row_hash`);--> statement-breakpoint
CREATE INDEX `idx_connections_url` ON `connections` (`url`);--> statement-breakpoint
CREATE INDEX `idx_connections_company` ON `connections` (`company`);--> statement-breakpoint
CREATE INDEX `idx_connections_position` ON `connections` (`position`);--> statement-breakpoint
CREATE INDEX `idx_connections_connected_on` ON `connections` (`connected_on`);--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_file` text NOT NULL,
	`table_name` text NOT NULL,
	`rows_in_export` integer NOT NULL,
	`rows_inserted` integer NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
