CREATE TABLE `visit_counts` (
	`day` text NOT NULL,
	`event` text NOT NULL,
	`source` text NOT NULL,
	`medium` text NOT NULL,
	`campaign` text NOT NULL,
	`creative` text NOT NULL,
	`country` text NOT NULL,
	`device` text NOT NULL,
	`n` integer NOT NULL,
	PRIMARY KEY(`day`, `event`, `source`, `medium`, `campaign`, `creative`, `country`, `device`)
);
