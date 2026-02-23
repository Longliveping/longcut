import { db } from './db';
import { videoAnalyses, userVideos } from './db/schema';
import { eq } from 'drizzle-orm';
import { getVideoByYoutubeId, linkVideoToUser } from './api/videos';

interface VideoAnalysisParams {
  youtubeId: string;
  title: string;
  author: string | null;
  duration: number;
  thumbnailUrl: string | null;
  transcript: unknown;
  topics: unknown;
  summary?: unknown;
  suggestedQuestions?: unknown;
  modelUsed?: string | null;
  userId?: string | null;
  language?: string | null;
  availableLanguages?: unknown;
}

interface SaveResult {
  success: boolean;
  videoId: string | null;
  error: string | null;
  retriedCount: number;
}

interface RetryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Saves video analysis with retry logic for transient failures.
 *
 * The main failure mode is FK constraint violations when the user's profile
 * hasn't been fully created yet (race condition on new signups). This function
 * retries with exponential backoff to handle such cases.
 */
export async function saveVideoAnalysisWithRetry(
  params: VideoAnalysisParams,
  options?: RetryOptions
): Promise<SaveResult> {
  const { maxRetries = 3, retryDelayMs = 500 } = options ?? {};

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const id = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      await db.insert(videoAnalyses).values({
        id,
        youtubeId: params.youtubeId,
        userId: params.userId ?? null,
        title: params.title,
        author: params.author,
        thumbnailUrl: params.thumbnailUrl,
        duration: params.duration,
        transcript: JSON.stringify(params.transcript ?? []),
        topics: JSON.stringify(params.topics ?? []),
        summary: JSON.stringify(params.summary ?? null),
        suggestedQuestions: JSON.stringify(params.suggestedQuestions ?? null),
        createdAt: now,
        updatedAt: now,
      });

      return {
        success: true,
        videoId: id,
        error: null,
        retriedCount: attempt
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check if this is a retryable error (FK constraint, profile not ready)
      const isRetryableError =
        errorMessage.includes('foreign key') ||
        errorMessage.includes('FOREIGN KEY constraint') ||
        errorMessage.includes('user_videos') ||
        errorMessage.includes('users');

      if (isRetryableError && attempt < maxRetries - 1) {
        console.warn(
          `[saveVideoAnalysis] Attempt ${attempt + 1}/${maxRetries} failed with retryable error, ` +
          `retrying in ${retryDelayMs * (attempt + 1)}ms:`,
          errorMessage
        );
        await new Promise(r => setTimeout(r, retryDelayMs * (attempt + 1)));
        continue;
      }

      console.error(
        `[saveVideoAnalysis] Attempt ${attempt + 1}/${maxRetries} failed (final):`,
        err
      );
    }
  }

  return {
    success: false,
    videoId: null,
    error: 'Max retries exceeded',
    retriedCount: maxRetries
  };
}

/**
 * Ensures a user_videos link exists for a given user and video.
 * This is a fallback mechanism for when the initial save fails but the video exists.
 */
export async function ensureUserVideoLink(
  userId: string,
  youtubeId: string
): Promise<{ linked: boolean; videoId: string | null; error: string | null }> {
  try {
    // First, check if the video exists
    const video = await getVideoByYoutubeId(youtubeId);

    if (!video) {
      return { linked: false, videoId: null, error: 'Video not found' };
    }

    // Use linkVideoToUser which handles onConflictDoNothing
    await linkVideoToUser(userId, video.id);

    return { linked: true, videoId: video.id, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[ensureUserVideoLink] Unexpected error:', err);
    return { linked: false, videoId: null, error: errorMessage };
  }
}
