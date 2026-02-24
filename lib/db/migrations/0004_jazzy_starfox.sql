PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_image_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`youtube_id` text NOT NULL,
	`video_id` text,
	`counted` integer DEFAULT true NOT NULL,
	`tier` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_image_generations`("id", "user_id", "youtube_id", "video_id", "counted", "tier", "created_at") SELECT "id", "user_id", "youtube_id", "video_id", "counted", "tier", "created_at" FROM `image_generations`;--> statement-breakpoint
DROP TABLE `image_generations`;--> statement-breakpoint
ALTER TABLE `__new_image_generations` RENAME TO `image_generations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`video_id` text,
	`source` text NOT NULL,
	`source_id` text,
	`text` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`video_id`) REFERENCES `video_analyses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_notes`("id", "user_id", "video_id", "source", "source_id", "text", "metadata", "created_at", "updated_at") SELECT "id", "user_id", "video_id", "source", "source_id", "text", "metadata", "created_at", "updated_at" FROM `notes`;--> statement-breakpoint
DROP TABLE `notes`;--> statement-breakpoint
ALTER TABLE `__new_notes` RENAME TO `notes`;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "user_id", "expires_at", "ip_address", "user_agent", "created_at", "updated_at") SELECT "id", "user_id", "expires_at", "ip_address", "user_agent", "created_at", "updated_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE TABLE `__new_video_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`identifier` text,
	`youtube_id` text NOT NULL,
	`video_id` text,
	`counted` integer DEFAULT true NOT NULL,
	`tier` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_video_generations`("id", "user_id", "identifier", "youtube_id", "video_id", "counted", "tier", "created_at") SELECT "id", "user_id", "identifier", "youtube_id", "video_id", "counted", "tier", "created_at" FROM `video_generations`;--> statement-breakpoint
DROP TABLE `video_generations`;--> statement-breakpoint
ALTER TABLE `__new_video_generations` RENAME TO `video_generations`;--> statement-breakpoint
-- Clean up existing duplicates before migrating user_videos table (keep earliest entry per user/video pair)
DELETE FROM `user_videos` WHERE id NOT IN (
  SELECT MIN(id) FROM `user_videos` GROUP BY `user_id`, `video_analysis_id`
);--> statement-breakpoint
CREATE TABLE `__new_user_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`video_analysis_id` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`video_analysis_id`) REFERENCES `video_analyses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_videos`("id", "user_id", "video_analysis_id", "is_favorite", "created_at") SELECT "id", "user_id", "video_analysis_id", "is_favorite", "created_at" FROM `user_videos`;--> statement-breakpoint
DROP TABLE `user_videos`;--> statement-breakpoint
ALTER TABLE `__new_user_videos` RENAME TO `user_videos`;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_user_video` ON `user_videos` (`user_id`,`video_analysis_id`);--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`name` text,
	`image` text,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`subscription_status` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`subscription_current_period_start` integer,
	`subscription_current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT 0 NOT NULL,
	`topup_credits` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "email_verified", "name", "image", "password_hash", "created_at", "updated_at", "tier", "subscription_status", "stripe_customer_id", "stripe_subscription_id", "subscription_current_period_start", "subscription_current_period_end", "cancel_at_period_end", "topup_credits") SELECT "id", "email", "email_verified", "name", "image", "password_hash", "created_at", "updated_at", "tier", "subscription_status", "stripe_customer_id", "stripe_subscription_id", "subscription_current_period_start", "subscription_current_period_end", "cancel_at_period_end", "topup_credits" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
ALTER TABLE `rate_limits` ADD `action` text NOT NULL;--> statement-breakpoint
ALTER TABLE `rate_limits` ADD `metadata` text;