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
CREATE INDEX `idx_connections_url` ON `connections` (`url`);--> statement-breakpoint
CREATE INDEX `idx_connections_company` ON `connections` (`company`);--> statement-breakpoint
CREATE INDEX `idx_connections_position` ON `connections` (`position`);--> statement-breakpoint
CREATE INDEX `idx_connections_connected_on` ON `connections` (`connected_on`);--> statement-breakpoint
CREATE TABLE `embeddings` (
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`embedding` blob NOT NULL,
	`model` text NOT NULL,
	`embedded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`kind`, `text`)
);
--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_file` text NOT NULL,
	`table_name` text NOT NULL,
	`rows_imported` integer NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
