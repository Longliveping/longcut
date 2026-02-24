/**
 * Database Helper for API Testing
 *
 * Provides utilities for managing test data in the database during API tests.
 * Uses SQLite with Drizzle ORM.
 */

import { db } from '@/lib/db';
import { users, videoAnalyses, notes, userVideos } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface TestUser {
  id: string;
  email: string;
  password?: string;
  full_name?: string;
  avatar_url?: string;
  tier?: 'free' | 'basic' | 'premium';
  subscriptionStatus?: string;
  topupCredits?: number;
}

export interface TestVideoAnalysis {
  id?: string;
  youtubeId: string;
  title: string;
  author?: string;
  duration?: number;
  thumbnailUrl?: string;
  transcript?: any;
  topics?: any;
  summary?: any;
  suggestedQuestions?: any;
}

export interface TestUserNote {
  id?: string;
  userId: string;
  videoId: string;
  source: 'chat' | 'takeaways' | 'transcript' | 'custom';
  sourceId?: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface TestUserVideo {
  id?: string;
  userId: string;
  videoAnalysisId: string;
  isFavorite?: boolean;
}

// ============================================================================
// Test Data Creation
// ============================================================================

/**
 * Create a test user in the database
 */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const userId = overrides.id || crypto.randomUUID();

  const testUser = {
    id: userId,
    email: overrides.email || `test-${userId.slice(0, 8)}@example.com`,
    passwordHash: 'fake-hash-for-testing',
    name: overrides.full_name || 'Test User',
    image: overrides.avatar_url || null,
    tier: overrides.tier || 'free',
    subscriptionStatus: overrides.subscriptionStatus || null,
    topupCredits: overrides.topupCredits ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.insert(users).values(testUser as any);

  return testUser;
}

/**
 * Create a test video analysis
 */
export async function createTestVideoAnalysis(
  data: TestVideoAnalysis
): Promise<TestVideoAnalysis & { id: string }> {
  const videoId = data.id || crypto.randomUUID();

  const videoAnalysis = {
    id: videoId,
    youtubeId: data.youtubeId,
    title: data.title,
    author: data.author || 'Test Author',
    duration: data.duration || 600,
    thumbnailUrl: data.thumbnailUrl || `https://example.com/thumb/${data.youtubeId}.jpg`,
    transcript: data.transcript || null,
    topics: data.topics || null,
    summary: data.summary || null,
    suggestedQuestions: data.suggestedQuestions || null,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  };

  await db.insert(videoAnalyses).values(videoAnalysis as any);

  return { ...data, id: videoId };
}

/**
 * Create a test user note
 */
export async function createTestUserNote(
  data: TestUserNote
): Promise<TestUserNote & { id: string }> {
  const noteId = data.id || crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const userNote = {
    id: noteId,
    userId: data.userId,
    videoId: data.videoId,
    source: data.source,
    sourceId: data.sourceId || null,
    text: data.text,
    metadata: data.metadata || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(notes).values(userNote as any);

  return { ...data, id: noteId };
}

/**
 * Create a test user video (history/favorite entry)
 */
export async function createTestUserVideo(
  data: TestUserVideo
): Promise<TestUserVideo & { id: string }> {
  const userVideoId = data.id || crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const userVideo = {
    id: userVideoId,
    userId: data.userId,
    videoAnalysisId: data.videoAnalysisId,
    isFavorite: data.isFavorite ?? false,
    createdAt: now,
  };

  await db.insert(userVideos).values(userVideo as any);

  return { ...data, id: userVideoId };
}

/**
 * Create a complete test scenario with user, video, and relationship
 */
export async function createTestScenario(options: {
  user?: Partial<TestUser>;
  video?: Partial<TestVideoAnalysis> & { youtubeId: string; title: string };
  isFavorite?: boolean;
  hasNotes?: boolean;
}) {
  const user = await createTestUser(options.user || {});
  const video = await createTestVideoAnalysis({
    youtubeId: options.video?.youtubeId || 'test-youtube-id',
    title: options.video?.title || 'Test Video',
    ...options.video,
  });

  const userVideo = await createTestUserVideo({
    userId: user.id,
    videoAnalysisId: video.id!,
    isFavorite: options.isFavorite || false,
  });

  let note: TestUserNote & { id: string } | null = null;
  if (options.hasNotes) {
    note = await createTestUserNote({
      userId: user.id,
      videoId: video.id!,
      source: 'custom',
      text: 'Test note for this video',
    });
  }

  return { user, video, userVideo, note };
}

// ============================================================================
// Test Data Cleanup
// ============================================================================

/**
 * Delete a test user by ID
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * Delete a test video analysis by ID
 */
export async function deleteTestVideoAnalysis(videoId: string): Promise<void> {
  await db.delete(videoAnalyses).where(eq(videoAnalyses.id, videoId));
}

/**
 * Delete a test user note by ID
 */
export async function deleteTestUserNote(noteId: string): Promise<void> {
  await db.delete(notes).where(eq(notes.id, noteId));
}

/**
 * Delete a test user video by ID
 */
export async function deleteTestUserVideo(userVideoId: string): Promise<void> {
  await db.delete(userVideos).where(eq(userVideos.id, userVideoId));
}

/**
 * Delete all test data created during a test run
 */
export async function cleanupTestData(userIds: string[] = []): Promise<void> {
  const errors: string[] = [];

  // Delete user relationships first (due to foreign key constraints)
  for (const userId of userIds) {
    try {
      await db.delete(notes).where(eq(notes.userId, userId));
      await db.delete(userVideos).where(eq(userVideos.userId, userId));
    } catch (e) {
      errors.push(`Failed to delete user relationships for ${userId}: ${e}`);
    }
  }

  // Delete users
  for (const userId of userIds) {
    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch (e) {
      errors.push(`Failed to delete user ${userId}: ${e}`);
    }
  }

  if (errors.length > 0) {
    console.warn('Cleanup completed with errors:', errors);
  }
}

/**
 * Clean up all data with test email patterns
 */
export async function cleanupTestUsersByEmailPattern(
  pattern: string = '%@example.com'
): Promise<number> {
  // For SQLite, we need to fetch matching users first
  const allUsers = await db.select().from(users);
  const matchingUsers = allUsers.filter(u => u.email.includes('@example.com'));

  const userIds = matchingUsers.map(u => u.id);

  // Clean up all related data
  await cleanupTestData(userIds);

  return userIds.length;
}

// ============================================================================
// Test Data Queries
// ============================================================================

/**
 * Get a test user by ID
 */
export async function getTestUser(userId: string): Promise<TestUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user || null;
}

/**
 * Get a test video analysis by ID
 */
export async function getTestVideoAnalysis(
  videoId: string
): Promise<TestVideoAnalysis & { id: string } | null> {
  const [video] = await db.select().from(videoAnalyses).where(eq(videoAnalyses.id, videoId));
  return video || null;
}

/**
 * Get a test video analysis by YouTube ID
 */
export async function getTestVideoAnalysisByYoutubeId(
  youtubeId: string
): Promise<TestVideoAnalysis & { id: string } | null> {
  const [video] = await db.select().from(videoAnalyses).where(eq(videoAnalyses.youtubeId, youtubeId));
  return video || null;
}

/**
 * Get all notes for a test user
 */
export async function getTestUserNotes(userId: string): Promise<TestUserNote[]> {
  return await db.select().from(notes).where(eq(notes.userId, userId));
}

/**
 * Get all videos for a test user
 */
export async function getTestUserVideos(userId: string): Promise<TestUserVideo[]> {
  return await db.select().from(userVideos).where(eq(userVideos.userId, userId));
}

/**
 * Count records in a table
 */
export async function countTableRecords(tableName: string): Promise<number> {
  let result = 0;

  switch (tableName) {
    case 'users':
      result = (await db.select().from(users)).length;
      break;
    case 'video_analyses':
      result = (await db.select().from(videoAnalyses)).length;
      break;
    case 'notes':
      result = (await db.select().from(notes)).length;
      break;
    case 'user_videos':
      result = (await db.select().from(userVideos)).length;
      break;
  }

  return result;
}

// ============================================================================
// Database State Utilities
// ============================================================================

/**
 * Check if database is accessible
 */
export async function isDatabaseAccessible(): Promise<boolean> {
  try {
    await db.select().from(users).limit(1);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncate all test tables (use with caution!)
 */
export async function truncateTestTables(): Promise<void> {
  // SQLite doesn't have TRUNCATE, use DELETE instead
  await db.delete(notes).run();
  await db.delete(userVideos).run();
  await db.delete(videoAnalyses).run();
  await db.delete(users).run();
}

// ============================================================================
// Client Management (kept for compatibility)
// ============================================================================

let dbClient: typeof db | null = null;

/**
 * Get the Drizzle database client for testing
 */
export function getTestDbClient() {
  if (!dbClient) {
    dbClient = db;
  }
  return dbClient;
}

/**
 * Reset the client instance (useful between test suites)
 */
export function resetTestDbClient() {
  dbClient = null;
}
