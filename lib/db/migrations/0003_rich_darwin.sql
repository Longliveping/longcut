CREATE TABLE `image_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`youtube_id` text NOT NULL,
	`video_id` text,
	`counted` integer DEFAULT true NOT NULL,
	`tier` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`video_id`) REFERENCES `video_analyses`(`id`) ON UPDATE no action ON DELETE no action
);
