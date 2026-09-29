CREATE TABLE `campaign_events` (
	`id` text PRIMARY KEY NOT NULL,
	`visit_id` text NOT NULL,
	`event` text NOT NULL,
	`source` text NOT NULL,
	`medium` text NOT NULL,
	`campaign` text NOT NULL,
	`creative` text NOT NULL,
	`country` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `campaign_events_campaign_created_idx` ON `campaign_events` (`campaign`,`created_at`);--> statement-breakpoint
CREATE TABLE `launch_leads` (
	`email` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`price_pence` integer NOT NULL,
	`consent_version` text NOT NULL,
	`consent_text` text NOT NULL,
	`consent_at` text NOT NULL,
	`source` text NOT NULL,
	`medium` text NOT NULL,
	`campaign` text NOT NULL,
	`creative` text NOT NULL,
	`visit_id` text,
	`preview_id` text NOT NULL,
	`country` text NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`unsubscribed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `launch_leads_unsubscribe_token_unique` ON `launch_leads` (`unsubscribe_token`);--> statement-breakpoint
CREATE INDEX `launch_leads_campaign_created_idx` ON `launch_leads` (`campaign`,`created_at`);--> statement-breakpoint
CREATE TABLE `preview_daily_usage` (
	`day` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preview_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
