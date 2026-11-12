ALTER TABLE `checks` ADD `token` text;--> statement-breakpoint
ALTER TABLE `checks` ADD `last_ping_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `checks_token_unique` ON `checks` (`token`);