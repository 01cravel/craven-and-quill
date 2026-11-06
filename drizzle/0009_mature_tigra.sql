CREATE TABLE `ad_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text,
	`created_at` text NOT NULL,
	`consent_version` text NOT NULL,
	`gclid` text,
	`gbraid` text,
	`wbraid` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `ad_leads_created_idx` ON `ad_leads` (`created_at`);