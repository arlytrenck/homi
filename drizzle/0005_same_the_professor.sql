CREATE TABLE `incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`check_id` text NOT NULL,
	`service_name` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`error` text,
	`affected_by` text,
	FOREIGN KEY (`check_id`) REFERENCES `checks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `incidents_started` ON `incidents` (`started_at`);--> statement-breakpoint
CREATE INDEX `incidents_check` ON `incidents` (`check_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `services` ADD `depends_on_id` text REFERENCES services(id) ON DELETE set null;