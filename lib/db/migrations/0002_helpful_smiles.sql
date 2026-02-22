-- Fix notes.userId column name to user_id for consistency
ALTER TABLE `notes` RENAME COLUMN `userId` TO `user_id`;
