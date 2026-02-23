CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`identifier` text NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `video_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`identifier` text NOT NULL,
	`youtube_id` text NOT NULL,
	`video_id` text,
	`counted` integer DEFAULT true NOT NULL,
	`tier` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`video_id`) REFERENCES `video_analyses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `tier` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_status` text;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_current_period_start` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `subscription_current_period_end` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `cancel_at_period_end` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `topup_credits` integer DEFAULT 0 NOT NULL;