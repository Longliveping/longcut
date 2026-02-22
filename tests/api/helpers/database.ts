/**
 * Database Helper for API Testing
 * 
 * Provides utilities for managing test data in the database during API tests.
 * Includes functions for creating, cleaning up, and querying test data.
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface TestUser {
  id: string;
  email: string;
  password?: string;
  full_name?: string;
  avatar_url?: string;
  subscription_tier?: 'free' | 'basic' | 'premium';
  subscription_status?: string;
  topup_credits?: number;
  topic_generation_mode?: 'smart' | 'fast';
}

export interface TestVideoAnalysis {
  id?: string;
  youtube_id: string;
  title: string;
  author?: string;
  duration?: number;
  thumbnail_url?: string;
  transcript?: any;
  topics?: any;
  summary?: any;
  suggested_questions?: any;
  model_used?: string;
}

export interface TestUserNote {
  id?: string;
  user_id: string;
  video_id: string;
  source: 'chat' | 'takeaways' | 'transcript' | 'custom';
  source_id?: string;
  note_text: string;
  metadata?: Record<string, any>;
}

export interface TestUserVideo {
  id?: string;
  user_id: string;
  video_id: string;
  is_favorite?: boolean;
  notes?: string;
  accessed_at?: string;
}

// ============================================================================
// Client Management
// ============================================================================

let supabaseClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or create a Supabase client for testing
 * Uses service role key for bypassing RLS in tests
 */
export function getTestDbClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables'
      );
    }

    supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }) as any;
  }

  return supabaseClient;
}

/**
 * Reset the client instance (useful between test suites)
 */
export function resetTestDbClient() {
  supabaseClient = null;
}

// ============================================================================
// Test Data Creation
// ============================================================================

/**
 * Create a test user in the database
 * Note: This creates the profile row, not the auth user
 */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const client = getTestDbClient();
  const userId = overrides.id || crypto.randomUUID();
  
  const testUser: Omit<TestUser, 'password'> = {
    id: userId,
    email: overrides.email || `test-${userId.slice(0, 8)}@example.com`,
    full_name: overrides.full_name || 'Test User',
    avatar_url: overrides.avatar_url || undefined,
    subscription_tier: overrides.subscription_tier || 'free',
    subscription_status: overrides.subscription_status || undefined,
    topup_credits: overrides.topup_credits ?? 0,
    topic_generation_mode: overrides.topic_generation_mode || 'smart',
  };

  const { error } = await client!
    .from('profiles')
    .insert(testUser as any);

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return testUser;
}

/**
 * Create a test video analysis
 */
export async function createTestVideoAnalysis(
  data: TestVideoAnalysis
): Promise<TestVideoAnalysis & { id: string }> {
  const client = getTestDbClient();
  const videoId = data.id || crypto.randomUUID();

  const videoAnalysis = {
    id: videoId,
    youtube_id: data.youtube_id,
    title: data.title,
    author: data.author || 'Test Author',
    duration: data.duration || 600,
    thumbnail_url: data.thumbnail_url || `https://example.com/thumb/${data.youtube_id}.jpg`,
    transcript: data.transcript || [],
    topics: data.topics || null,
    summary: data.summary || null,
    suggested_questions: data.suggested_questions || null,
    model_used: data.model_used || 'gemini-2.5-flash',
  };

  const { error } = await client!
    .from('video_analyses')
    .insert(videoAnalysis as any);

  if (error) {
    throw new Error(`Failed to create test video analysis: ${error.message}`);
  }

  return { ...data, id: videoId };
}

/**
 * Create a test user note
 */
export async function createTestUserNote(
  data: TestUserNote
): Promise<TestUserNote & { id: string }> {
  const client = getTestDbClient();
  const noteId = data.id || crypto.randomUUID();

  const userNote = {
    id: noteId,
    user_id: data.user_id,
    video_id: data.video_id,
    source: data.source,
    source_id: data.source_id || null,
    note_text: data.note_text,
    metadata: data.metadata || null,
  };

  const { error } = await client!
    .from('user_notes')
    .insert(userNote as any);

  if (error) {
    throw new Error(`Failed to create test user note: ${error.message}`);
  }

  return { ...data, id: noteId };
}

/**
 * Create a test user video (history/favorite entry)
 */
export async function createTestUserVideo(
  data: TestUserVideo
): Promise<TestUserVideo & { id: string }> {
  const client = getTestDbClient();
  const userVideoId = data.id || crypto.randomUUID();

  const userVideo = {
    id: userVideoId,
    user_id: data.user_id,
    video_id: data.video_id,
    is_favorite: data.is_favorite ?? false,
    notes: data.notes || null,
    accessed_at: data.accessed_at || new Date().toISOString(),
  };

  const { error } = await client!
    .from('user_videos')
    .insert(userVideo as any);

  if (error) {
    throw new Error(`Failed to create test user video: ${error.message}`);
  }

  return { ...data, id: userVideoId };
}

/**
 * Create a complete test scenario with user, video, and relationship
 */
export async function createTestScenario(options: {
  user?: Partial<TestUser>;
  video?: Partial<TestVideoAnalysis> & { youtube_id: string; title: string };
  isFavorite?: boolean;
  hasNotes?: boolean;
}) {
  const user = await createTestUser(options.user || {});
  const video = await createTestVideoAnalysis({
    youtube_id: options.video?.youtube_id || 'test-youtube-id',
    title: options.video?.title || 'Test Video',
    ...options.video,
  });

  const userVideo = await createTestUserVideo({
    user_id: user.id,
    video_id: video.id!,
    is_favorite: options.isFavorite || false,
  });

  let note: TestUserNote & { id: string } | null = null;
  if (options.hasNotes) {
    note = await createTestUserNote({
      user_id: user.id,
      video_id: video.id!,
      source: 'custom',
      note_text: 'Test note for this video',
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
  const client = getTestDbClient();

  const { error } = await client!
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to delete test user: ${error.message}`);
  }
}

/**
 * Delete a test video analysis by ID
 */
export async function deleteTestVideoAnalysis(videoId: string): Promise<void> {
  const client = getTestDbClient();

  const { error } = await client!
    .from('video_analyses')
    .delete()
    .eq('id', videoId);

  if (error) {
    throw new Error(`Failed to delete test video analysis: ${error.message}`);
  }
}

/**
 * Delete a test user note by ID
 */
export async function deleteTestUserNote(noteId: string): Promise<void> {
  const client = getTestDbClient();

  const { error } = await client!
    .from('user_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    throw new Error(`Failed to delete test user note: ${error.message}`);
  }
}

/**
 * Delete a test user video by ID
 */
export async function deleteTestUserVideo(userVideoId: string): Promise<void> {
  const client = getTestDbClient();

  const { error } = await client!
    .from('user_videos')
    .delete()
    .eq('id', userVideoId);

  if (error) {
    throw new Error(`Failed to delete test user video: ${error.message}`);
  }
}

/**
 * Delete all test data created during a test run
 * Identifies test data by email pattern or specific IDs
 */
export async function cleanupTestData(userIds: string[] = []): Promise<void> {
  const client = getTestDbClient();
  const errors: string[] = [];

  // Delete user relationships first (due to foreign key constraints)
  for (const userId of userIds) {
    try {
      await client!.from('user_notes').delete().eq('user_id', userId);
      await client!.from('user_videos').delete().eq('user_id', userId);
    } catch (e) {
      errors.push(`Failed to delete user relationships for ${userId}: ${e}`);
    }
  }

  // Delete users
  for (const userId of userIds) {
    try {
      await client!.from('profiles').delete().eq('id', userId);
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
 * Useful for cleaning up orphaned test data
 */
export async function cleanupTestUsersByEmailPattern(
  pattern: string = '%@example.com'
): Promise<number> {
  const client = getTestDbClient();

  // First, get all matching user IDs
  const { data: users, error } = await client!
    .from('profiles')
    .select('id')
    .like('email', pattern);

  if (error) {
    throw new Error(`Failed to query test users: ${error.message}`);
  }

  const userIds = users?.map((u: any) => u.id) || [];

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
  const client = getTestDbClient();

  const { data, error } = await client!
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get test user: ${error.message}`);
  }

  return data as TestUser;
}

/**
 * Get a test video analysis by ID
 */
export async function getTestVideoAnalysis(
  videoId: string
): Promise<TestVideoAnalysis & { id: string } | null> {
  const client = getTestDbClient();

  const { data, error } = await client!
    .from('video_analyses')
    .select('*')
    .eq('id', videoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get test video analysis: ${error.message}`);
  }

  return data as TestVideoAnalysis & { id: string };
}

/**
 * Get a test video analysis by YouTube ID
 */
export async function getTestVideoAnalysisByYoutubeId(
  youtubeId: string
): Promise<TestVideoAnalysis & { id: string } | null> {
  const client = getTestDbClient();

  const { data, error } = await client!
    .from('video_analyses')
    .select('*')
    .eq('youtube_id', youtubeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get test video analysis: ${error.message}`);
  }

  return data as TestVideoAnalysis & { id: string };
}

/**
 * Get all notes for a test user
 */
export async function getTestUserNotes(userId: string): Promise<TestUserNote[]> {
  const client = getTestDbClient();

  const { data, error } = await client!
    .from('user_notes')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to get test user notes: ${error.message}`);
  }

  return (data as TestUserNote[]) || [];
}

/**
 * Get all videos for a test user
 */
export async function getTestUserVideos(userId: string): Promise<TestUserVideo[]> {
  const client = getTestDbClient();

  const { data, error } = await client!
    .from('user_videos')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to get test user videos: ${error.message}`);
  }

  return (data as TestUserVideo[]) || [];
}

/**
 * Count records in a table
 */
export async function countTableRecords(tableName: string): Promise<number> {
  const client = getTestDbClient();

  const { count, error } = await client!
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count ${tableName} records: ${error.message}`);
  }

  return count || 0;
}

// ============================================================================
// Database State Utilities
// ============================================================================

/**
 * Check if database is accessible
 */
export async function isDatabaseAccessible(): Promise<boolean> {
  try {
    const client = getTestDbClient();
    const { error } = await client!.from('profiles').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Truncate all test tables (use with caution!)
 * This is faster than deleting individual records but more dangerous
 */
export async function truncateTestTables(): Promise<void> {
  const client = getTestDbClient();
  const tables = [
    'user_notes',
    'user_videos',
    'video_analyses',
    'video_generations',
    'rate_limits',
  ];

  for (const table of tables) {
    const { error } = await (client as any).rpc('truncate_table', {
      table_name: table 
    } as any);
    if (error) {
      console.warn(`Failed to truncate ${table}: ${error.message}`);
    }
  }
}

/**
 * Begin a database transaction for isolated testing
 * Note: This requires the database to have transaction support enabled
 */
export async function withTestTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  const client = getTestDbClient();
  
  try {
    // Begin transaction
    await client!.rpc('begin_transaction');
    
    // Execute callback
    const result = await callback();
    
    // Rollback transaction (clean up test data)
    await client!.rpc('rollback_transaction');
    
    return result;
  } catch (error) {
    // Ensure rollback on error
    try {
      await client!.rpc('rollback_transaction');
    } catch {
      // Ignore rollback errors
    }
    throw error;
  }
}
