CREATE TABLE `visit_details` (
	`visit_id` text PRIMARY KEY NOT NULL,
	`ip_prefix` text,
	`town` text,
	`region` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visit_details_created_idx` ON `visit_details` (`created_at`);--> statement-breakpoint
CREATE TABLE `visit_links` (
	`visit_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`visit_id`, `kind`, `ref`)
);
--> statement-breakpoint
CREATE INDEX `visit_links_created_idx` ON `visit_links` (`created_at`);