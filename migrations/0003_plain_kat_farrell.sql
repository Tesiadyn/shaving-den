CREATE TABLE `share` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `share_user_idx` ON `share` (`user_id`);--> statement-breakpoint
CREATE TABLE `share_item` (
	`share_id` text NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`share_id`, `item_id`),
	FOREIGN KEY (`share_id`) REFERENCES `share`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `share_item_item_idx` ON `share_item` (`item_id`);