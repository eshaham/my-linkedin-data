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
--> statement-breakpoint
CREATE TABLE `linkedin_export_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text,
	`last_name` text,
	`url` text,
	`public_identifier` text,
	`email` text,
	`company` text,
	`position` text,
	`connected_on` text
);
--> statement-breakpoint
CREATE INDEX `idx_lec_public_identifier` ON `linkedin_export_connections` (`public_identifier`);--> statement-breakpoint
CREATE INDEX `idx_lec_company` ON `linkedin_export_connections` (`company`);--> statement-breakpoint
CREATE INDEX `idx_lec_position` ON `linkedin_export_connections` (`position`);--> statement-breakpoint
CREATE INDEX `idx_lec_connected_on` ON `linkedin_export_connections` (`connected_on`);--> statement-breakpoint
CREATE TABLE `linkedin_export_my_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_name` text,
	`title` text,
	`description` text,
	`location` text,
	`started_on` text,
	`finished_on` text
);
--> statement-breakpoint
CREATE INDEX `idx_lemp_company` ON `linkedin_export_my_positions` (`company_name`);--> statement-breakpoint
CREATE INDEX `idx_lemp_started` ON `linkedin_export_my_positions` (`started_on`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`linkedin_urn` text,
	`linkedin_id` text,
	`public_identifier` text,
	`first_name` text,
	`last_name` text,
	`headline` text,
	`job_title` text,
	`summary` text,
	`current_company_name` text,
	`current_company_public_id` text,
	`current_company_linkedin_url` text,
	`country_code` text,
	`geo_country_name` text,
	`geo_location_name` text,
	`geo_urn` text,
	`connections_count` integer,
	`follower_count` integer,
	`is_verified` integer,
	`premium` integer,
	`creator` integer,
	`influencer` integer,
	`connection_type` text,
	`picture_url` text,
	`cover_image_url` text,
	`first_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_enriched_at` text,
	`last_enrichment_source` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_linkedin_urn_unique` ON `people` (`linkedin_urn`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_linkedin_id_unique` ON `people` (`linkedin_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_public_identifier_unique` ON `people` (`public_identifier`);--> statement-breakpoint
CREATE INDEX `idx_people_country` ON `people` (`country_code`);--> statement-breakpoint
CREATE INDEX `idx_people_current_company` ON `people` (`current_company_name`);--> statement-breakpoint
CREATE TABLE `person_enrichments` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`input_url` text,
	`source` text NOT NULL,
	`raw_json` text NOT NULL,
	`fetched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pe_person` ON `person_enrichments` (`person_id`);--> statement-breakpoint
CREATE TABLE `person_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`company_name` text NOT NULL,
	`title` text,
	`location_name` text,
	`description` text,
	`started_on` text,
	`finished_on` text,
	`still_working` integer,
	`source` text NOT NULL,
	`enriched_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pp_person` ON `person_positions` (`person_id`);--> statement-breakpoint
CREATE INDEX `idx_pp_company` ON `person_positions` (`company_name`);