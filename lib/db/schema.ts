import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
})

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
  videoAnalysisId: text('video_analysis_id').notNull().references(() => videoAnalyses.id),
  isFavorite: integer('is_favorite').notNull().default(0),
  createdAt: integer('created_at').notNull(),
})

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  videoId: text('video_id').notNull().references(() => videoAnalyses.id),
  source: text('source').notNull(), // 'chat' | 'takeaways' | 'transcript' | 'custom'
  sourceId: text('source_id'),
  text: text('text').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})
