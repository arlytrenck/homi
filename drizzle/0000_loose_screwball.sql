CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`group_label` text DEFAULT 'Bookmarks' NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`icon` text,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `check_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`check_id` text NOT NULL,
	`ts` integer NOT NULL,
	`ok` integer NOT NULL,
	`latency_ms` integer,
	`code` integer,
	`error` text,
	FOREIGN KEY (`check_id`) REFERENCES `checks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `check_results_check_ts` ON `check_results` (`check_id`,`ts`);--> statement-breakpoint
CREATE TABLE `check_rollups` (
	`check_id` text NOT NULL,
	`bucket_ts` integer NOT NULL,
	`samples` integer NOT NULL,
	`ups` integer NOT NULL,
	`avg_latency` real,
	PRIMARY KEY(`check_id`, `bucket_ts`),
	FOREIGN KEY (`check_id`) REFERENCES `checks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checks` (
	`id` text PRIMARY KEY NOT NULL,
	`service_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`target` text NOT NULL,
	`interval_s` integer DEFAULT 60 NOT NULL,
	`timeout_ms` integer DEFAULT 5000 NOT NULL,
	`http_method` text DEFAULT 'GET' NOT NULL,
	`expected_status` text DEFAULT '200-399' NOT NULL,
	`keyword` text,
	`ignore_tls` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_status` text DEFAULT 'unknown' NOT NULL,
	`last_latency_ms` integer,
	`last_checked_at` integer,
	`last_change_at` integer,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checks_service_id_unique` ON `checks` (`service_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`collapsed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`secrets` text,
	`ignore_tls` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`poll_interval_s` integer DEFAULT 60 NOT NULL,
	`last_ok_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body_md` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text,
	`name` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`icon` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`target_blank` integer DEFAULT true NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`hidden_public` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`ip` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`integration_id` text,
	`title` text,
	`options` text DEFAULT '{}' NOT NULL,
	`area` text DEFAULT 'main' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`size` text DEFAULT 'md' NOT NULL,
	`hidden_public` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON UPDATE no action ON DELETE cascade
);
