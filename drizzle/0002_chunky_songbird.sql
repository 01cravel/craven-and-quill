CREATE TABLE `preview_contacts` (
	`email` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`medium` text NOT NULL,
	`campaign` text NOT NULL,
	`creative` text NOT NULL,
	`country` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `preview_contacts_campaign_created_idx` ON `preview_contacts` (`campaign`,`created_at`);