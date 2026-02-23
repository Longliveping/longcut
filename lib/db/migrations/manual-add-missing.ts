#!/usr/bin/env node
/**
 * Manual migration to add missing tables and columns
 * This adds:
 * - Subscription fields to users table
 * - video_generations table
 * - rate_limits table
 * - image_generations table
 */

import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_URL || './local.db';
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

try {
  console.log('Starting manual migration...');

  // Add subscription fields to users table if they don't exist
  const userColumns = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
  if (userColumns && !userColumns.sql.includes('tier')) {
    console.log('Adding subscription fields to users table...');
    db.exec(`
      ALTER TABLE users ADD COLUMN tier TEXT NOT NULL DEFAULT 'free';
      ALTER TABLE users ADD COLUMN subscription_status TEXT;
      ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
      ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
      ALTER TABLE users ADD COLUMN subscription_current_period_start INTEGER;
      ALTER TABLE users ADD COLUMN subscription_current_period_end INTEGER;
      ALTER TABLE users ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN topup_credits INTEGER NOT NULL DEFAULT 0;
    `);
    console.log('✓ Added subscription fields to users table');
  } else {
    console.log('✓ Subscription fields already exist in users table');
  }

  // Create video_generations table if it doesn't exist
  const videoGenExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='video_generations'").get() as any;
  if (!videoGenExists) {
    console.log('Creating video_generations table...');
    db.exec(`
      CREATE TABLE video_generations (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        identifier TEXT NOT NULL,
        youtube_id TEXT NOT NULL,
        video_id TEXT REFERENCES video_analyses(id),
        counted INTEGER NOT NULL DEFAULT 1,
        tier TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_video_generations_user_id ON video_generations(user_id);
      CREATE INDEX idx_video_generations_youtube_id ON video_generations(youtube_id);
    `);
    console.log('✓ Created video_generations table');
  } else {
    console.log('✓ video_generations table already exists');
  }

  // Create rate_limits table if it doesn't exist
  const rateLimitsExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rate_limits'").get() as any;
  if (!rateLimitsExists) {
    console.log('Creating rate_limits table...');
    db.exec(`
      CREATE TABLE rate_limits (
        id TEXT PRIMARY KEY NOT NULL,
        key TEXT NOT NULL,
        identifier TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
    console.log('✓ Created rate_limits table');
  } else {
    console.log('✓ rate_limits table already exists');
  }

  // Create image_generations table if it doesn't exist
  const imageGenExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='image_generations'").get() as any;
  if (!imageGenExists) {
    console.log('Creating image_generations table...');
    db.exec(`
      CREATE TABLE image_generations (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        youtube_id TEXT NOT NULL,
        video_id TEXT REFERENCES video_analyses(id),
        counted INTEGER NOT NULL DEFAULT 1,
        tier TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_image_generations_user_id ON image_generations(user_id);
      CREATE INDEX idx_image_generations_youtube_id ON image_generations(youtube_id);
    `);
    console.log('✓ Created image_generations table');
  } else {
    console.log('✓ image_generations table already exists');
  }

  console.log('✓ Migration completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
