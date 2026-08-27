CREATE TABLE `blade_swap` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`installed_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `item`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `blade_swap_item_idx` ON `blade_swap` (`item_id`,`installed_at`);