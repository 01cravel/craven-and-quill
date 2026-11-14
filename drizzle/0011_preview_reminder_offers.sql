CREATE TABLE `reminder_offers` (
	`email` text PRIMARY KEY NOT NULL,
	`discount_code` text NOT NULL,
	`code_expires_at` text NOT NULL,
	`email_status` text NOT NULL,
	`redeemed_order_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_offers_discount_code_unique` ON `reminder_offers` (`discount_code`);