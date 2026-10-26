CREATE TABLE `customer_quotes` (
	`email` text PRIMARY KEY NOT NULL,
	`size` text NOT NULL,
	`price_pence` integer NOT NULL,
	`catalogue_version` text NOT NULL,
	`first_shown_at` text NOT NULL,
	`last_shown_at` text NOT NULL,
	`offer_consent_at` text,
	`offer_unsubscribed_at` text,
	`unsubscribe_token` text NOT NULL,
	`discount_code` text,
	`discount_pence` integer,
	`code_expires_at` text,
	`email_status` text,
	`email_sent_at` text,
	`email_provider_id` text,
	`redeemed_order_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_quotes_unsubscribe_token_unique` ON `customer_quotes` (`unsubscribe_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_quotes_discount_code_unique` ON `customer_quotes` (`discount_code`);--> statement-breakpoint
CREATE INDEX `customer_quotes_last_shown_idx` ON `customer_quotes` (`last_shown_at`);