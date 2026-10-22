CREATE TABLE `customer_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`size` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`payment_status` text NOT NULL,
	`payment_mode` text,
	`session_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_orders_status_idx` ON `customer_orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
