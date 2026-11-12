CREATE TABLE `maintenance_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text,
	`days` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_min` integer NOT NULL,
	`tz` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`handled_until` integer NOT NULL,
	`created_at` integer NOT NULL
);
