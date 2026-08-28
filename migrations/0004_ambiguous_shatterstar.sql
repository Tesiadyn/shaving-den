CREATE TABLE `shave_share` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`shave_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shave_id`) REFERENCES `shave`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shave_share_shave_id_unique` ON `shave_share` (`shave_id`);--> statement-breakpoint
CREATE INDEX `shave_share_user_idx` ON `shave_share` (`user_id`);