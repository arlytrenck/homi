CREATE TABLE `maintenance_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`end_handled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `maintenance_ends` ON `maintenance_windows` (`ends_at`);