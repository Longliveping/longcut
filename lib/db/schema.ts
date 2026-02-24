import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Users table - compatible with Lucia auth
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  // Lucia expects emailVerified as number (0 or 1)
  emailVerified: integer('email_verified').notNull().default(0),
  name: text('name'),
  image: text('image'),
  passwordHash: text('password_hash').notNull(),
  // Timestamps as text for flexibility
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  // Subscription fields
  tier: text('tier').notNull().default('free'), // 'free' | 'pro' | 'enterprise'
  subscriptionStatus: text('subscription_status'), // 'active' | 'past_due' | 'canceled' | 'incomplete'
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  subscriptionCurrentPeriodStart: integer('subscription_current_period_start'),
  subscriptionCurrentPeriodEnd: integer('subscription_current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end').notNull().default(0),
  topupCredits: integer('topup_credits').notNull().default(0),
})

// Sessions table - compatible with Lucia auth
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(),
  // Additional metadata fields (optional)
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

// Video analyses table
export const videoAnalyses = sqliteTable('video_analyses', {
  id: text('id').primaryKey(),
  youtubeId: text('youtube_id').notNull().unique(),
  userId: text('user_id').references(() => users.id),
  title: text('title').notNull(),
  author: text('author'),
  thumbnailUrl: text('thumbnail_url'),
  duration: integer('duration'),
  transcript: text('transcript'), // JSON string
  topics: text('topics'), // JSON string
  summary: text('summary'), // JSON string
  suggestedQuestions: text('suggested_questions'), // JSON string
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const userVideos = sqliteTable('user_videos', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  videoAnalysisId: text('video_analysis_id').references(() => videoAnalyses.id),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: text('video_id').references(() => videoAnalyses.id, { onDelete: 'cascade' }),
  source: text('source').notNull(), // 'chat' | 'takeaways' | 'transcript' | 'custom'
  sourceId: text('source_id'),
  text: text('text').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const videoGenerations = sqliteTable('video_generations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  identifier: text('identifier'), // Optional identifier for tracking (e.g., IP, session)
  youtubeId: text('youtube_id').notNull(),
  videoId: text('video_id'), // Reference to video_analyses if analysis was generated
  counted: integer('counted', { mode: 'boolean' }).notNull().default(true),
  tier: text('tier').notNull(), // 'free' | 'pro' | 'enterprise'
  createdAt: integer('created_at').notNull(),
})

export const imageGenerations = sqliteTable('image_generations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  youtubeId: text('youtube_id').notNull(),
  videoId: text('video_id'), // Reference to video_analyses if analysis was generated
  counted: integer('counted', { mode: 'boolean' }).notNull().default(true),
  tier: text('tier').notNull(), // 'free' | 'pro' | 'enterprise'
  createdAt: integer('created_at').notNull(),
})

export const rateLimits = sqliteTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull(), // Composite key for rate limiting (e.g., "ratelimit:video_generation:user:xxx")
  identifier: text('identifier').notNull(), // IP address, user ID, or session token
  action: text('action').notNull(), // 'video_generation', 'image_generation', etc.
  timestamp: integer('timestamp').notNull(),
  metadata: text('metadata'), // JSON string with additional context
})
