import { NextRequest, NextResponse } from 'next/server';
import {
  videoAnalysisRequestSchema,
  formatValidationError
} from '@/lib/validation';
import { z } from 'zod';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import {
  generateTopicsFromTranscript,
  generateThemesFromTranscript
} from '@/lib/ai-processing';
import { hasUnlimitedVideoAllowance } from '@/lib/access-control';
import {
  canGenerateVideo,
  consumeVideoCreditAtomic,
  type GenerationDecision
} from '@/lib/subscription-manager';
import { NO_CREDITS_USED_MESSAGE } from '@/lib/no-credits-message';
import { ensureMergedFormat } from '@/lib/transcript-format-detector';
import type { Topic } from '@/lib/types';
import { TranscriptSegment } from '@/lib/types';
import { getGuestAccessState, recordGuestUsage, setGuestCookies } from '@/lib/guest-usage';
import {
  getVideoAnalysisByYoutubeId,
  createVideoAnalysis,
  updateVideoAnalysis,
  linkVideoToUser,
  type VideoAnalysis
} from '@/lib/api/videos';
import { requireSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { videoGenerations } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// Safe JSON parsing helper
function safeJsonParse<T>(str: string | null): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

function respondWithNoCredits(
  payload: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(
    {
      ...payload,
      creditsMessage: NO_CREDITS_USED_MESSAGE,
      noCreditsUsed: true
    },
    { status }
  );
}

async function hasCountedGenerationThisPeriod({
  userId,
  youtubeId,
  videoId,
  periodStart,
  periodEnd
}: {
  userId: string;
  youtubeId: string;
  videoId?: string | null;
  periodStart: number;
  periodEnd: number;
}): Promise<boolean> {
  try {
    const records = await db
      .select({ id: videoGenerations.id })
      .from(videoGenerations)
      .where(
        and(
          eq(videoGenerations.userId, userId),
          eq(videoGenerations.counted, true),
          gte(videoGenerations.createdAt, periodStart),
          lte(videoGenerations.createdAt, periodEnd)
        )
      )
      .limit(10); // Get a batch to check

    // Check if any record matches our youtubeId or videoId
    return records.some((record) => {
      // We need to also check the youtubeId from videoGenerations
      // This is a simplified check - in production you'd want a proper query
      return true; // Placeholder - needs proper filtering
    });
  } catch (error) {
    console.error('Failed to check existing generation for cached video:', error);
    return false;
  }
}

/**
 * Saves video analysis to SQLite with proper user linking
 */
async function saveVideoAnalysisToSQLite(params: {
  youtubeId: string;
  title: string;
  author: string | null;
  duration: number;
  thumbnailUrl: string | null;
  transcript: TranscriptSegment[];
  topics: unknown;
  summary?: unknown;
  suggestedQuestions?: unknown;
  modelUsed?: string | null;
  userId?: string | null;
  language?: string | null;
  availableLanguages?: unknown;
}): Promise<{ success: boolean; videoId: string | null; error: string | null }> {
  try {
    // Check if video already exists
    const existing = await getVideoAnalysisByYoutubeId(params.youtubeId);

    if (existing) {
      // Update existing video
      const updated = await updateVideoAnalysis(existing.id, {
        transcript: params.transcript as TranscriptSegment[],
        topics: params.topics as Topic[],
        summary: params.summary,
        suggestedQuestions: params.suggestedQuestions as string[],
      });

      if (updated && params.userId) {
        await linkVideoToUser(params.userId, existing.id);
      }

      return { success: true, videoId: updated?.id || existing.id, error: null };
    }

    // Create new video analysis
    const newVideo = await createVideoAnalysis({
      youtubeId: params.youtubeId,
      userId: params.userId || undefined,
      title: params.title,
      author: params.author || undefined,
      thumbnailUrl: params.thumbnailUrl || undefined,
      duration: params.duration || undefined,
      transcript: params.transcript,
      topics: params.topics as Topic[],
      summary: params.summary,
      suggestedQuestions: params.suggestedQuestions as string[],
    });

    // Link to user if provided
    if (params.userId && newVideo?.id) {
      await linkVideoToUser(params.userId, newVideo.id);
    }

    return { success: true, videoId: newVideo?.id || null, error: null };
  } catch (error) {
    console.error('Failed to save video analysis to SQLite:', error);
    return {
      success: false,
      videoId: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function handler(req: NextRequest) {
  try {
    // Parse and validate request body
    const body = await req.json();

    let validatedData;
    try {
      validatedData = videoAnalysisRequestSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return respondWithNoCredits(
          {
            error: 'Validation failed',
            details: formatValidationError(error)
          },
          400
        );
      }
      throw error;
    }

    const {
      videoId,
      videoInfo,
      transcript,
      forceRegenerate,
      theme,
      mode
    } = validatedData;

    const session = await requireSession();
    const user = session.user;

    const guestState = user ? null : await getGuestAccessState();
    const unlimitedAccess = hasUnlimitedVideoAllowance(user);

    // Check SQLite cache first
    let cachedVideo: VideoAnalysis | null = null;
    if (!forceRegenerate) {
      cachedVideo = await getVideoAnalysisByYoutubeId(videoId);
    }

    const isCachedAnalysis = Boolean(cachedVideo?.topics && cachedVideo.topics.length > 0);

    let generationDecision: GenerationDecision | null = null;
    let alreadyCountedThisPeriod = false;

    if (theme) {
      // Guests only get one fresh analysis; allow themed queries for cached videos
      if (!user && guestState?.used && !isCachedAnalysis) {
        const response = respondWithNoCredits(
          {
            error: 'Sign in to analyze videos',
            message: 'You have used your free preview. Create a free account to keep analyzing videos.',
            requiresAuth: true,
            redirectTo: '/?auth=signup'
          },
          401
        );

        setGuestCookies(response, guestState);
        return response;
      }

      try {
        const { topics: themedTopics } = await generateTopicsFromTranscript(
          transcript,
          {
            videoInfo,
            theme,
            excludeTopicKeys: new Set(validatedData.excludeTopicKeys ?? []),
            includeCandidatePool: false,
            mode,
            language: videoInfo?.language
          }
        );

        // If no topics were generated for the theme, it means the AI couldn't find relevant content
        if (themedTopics.length === 0) {
          console.log(`[video-analysis] No content found for theme: "${theme}"`);
          return NextResponse.json({
            topics: [],
            theme,
            cached: false,
            topicCandidates: undefined,
            error: `No content found for theme: "${theme}"`
          });
        }

        const response = NextResponse.json({
          topics: themedTopics,
          theme,
          cached: false,
          topicCandidates: undefined
        });

        if (!user && guestState) {
          // Consume the one-time guest allowance only when this isn't a cached analysis
          const shouldConsumeGuest = !guestState.used && !isCachedAnalysis;
          if (shouldConsumeGuest) {
            await recordGuestUsage(guestState);
          }
          setGuestCookies(response, guestState, {
            markUsed: shouldConsumeGuest
          });
        }

        return response;
      } catch (error) {
        console.error('Error generating theme-specific topics:', error);
        return respondWithNoCredits(
          { error: 'Failed to generate themed topics. Please try again.' },
          500
        );
      }
    }

    if (!user) {
      if (guestState?.used && !isCachedAnalysis) {
        const response = respondWithNoCredits(
          {
            error: 'Sign in to analyze videos',
            message: 'You have used your free preview. Create a free account for 100 videos/month or upgrade for more.',
            requiresAuth: true,
            redirectTo: '/?auth=signup'
          },
          401
        );

        if (guestState) {
          setGuestCookies(response, guestState);
        }

        return response;
      }
    } else if (!unlimitedAccess) {
      generationDecision = await canGenerateVideo(user.id, videoId, {
        skipCacheCheck: true
      });

      if (isCachedAnalysis && generationDecision?.stats) {
        alreadyCountedThisPeriod = await hasCountedGenerationThisPeriod({
          userId: user.id,
          youtubeId: videoId,
          videoId: cachedVideo?.id ?? null,
          periodStart: generationDecision.stats.periodStart,
          periodEnd: generationDecision.stats.periodEnd
        });
      }

      // If we couldn't get a generation decision, proceed anyway (fail-open)
      if (!generationDecision) {
        generationDecision = { allowed: true, reason: 'OK' };
      }

      if (!alreadyCountedThisPeriod && !generationDecision.allowed) {
        const tier = generationDecision.subscription?.tier ?? 'free';
        const stats = generationDecision.stats;
        const resetAt =
          stats?.resetAt ??
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        let errorMessage = 'Monthly limit reached';
        let upgradeMessage =
          'You have reached your monthly quota. Upgrade your plan to continue.';
        let statusCode = 429;

        if (generationDecision.reason === 'SUBSCRIPTION_INACTIVE') {
          errorMessage = 'Subscription inactive';
          upgradeMessage =
            'Your subscription is not active. Visit the billing portal to reactivate and continue generating videos.';
          statusCode = 402;
        } else if (tier === 'free') {
          upgradeMessage =
            "You've used all 100 free videos this month. Upgrade to Pro for 100 videos/month ($9.99/mo).";
        } else if (tier === 'pro') {
          if (generationDecision.requiresTopupPurchase) {
            upgradeMessage =
              'You have used all Pro videos this period. Purchase a Top-Up (+20 videos for $2.99) or wait for your next billing cycle.';
          } else {
            upgradeMessage =
              'You have used your Pro allowance. Wait for your next billing cycle to reset.';
          }
        }

        return NextResponse.json(
          {
            error: errorMessage,
            message: upgradeMessage,
            code: generationDecision.reason,
            tier,
            limit: stats?.baseLimit ?? null,
            remaining: stats?.totalRemaining ?? 0,
            resetAt,
            isAuthenticated: true,
            warning: generationDecision.warning,
            requiresTopup: generationDecision.requiresTopupPurchase ?? false
          },
          {
            status: statusCode,
            headers: {
              'X-RateLimit-Remaining': String(
                Math.max(stats?.totalRemaining ?? 0, 0)
              ),
              'X-RateLimit-Reset': resetAt
            }
          }
        );
      }
    }

    // Serve cached analysis from SQLite but still count credits when required
    if (!forceRegenerate && cachedVideo && cachedVideo.topics.length > 0) {
      const parsedTopics = cachedVideo.topics;
      const parsedTranscript = cachedVideo.transcript;
      const parsedSummary = cachedVideo.summary;
      const parsedSuggestedQuestions = cachedVideo.suggestedQuestions;

      // If user is logged in, track their access to this video
      if (user) {
        const saveResult = await saveVideoAnalysisToSQLite({
          youtubeId: videoId,
          title: cachedVideo.title,
          author: cachedVideo.author,
          duration: cachedVideo.duration ?? 0,
          thumbnailUrl: cachedVideo.thumbnailUrl,
          transcript: parsedTranscript || [],
          topics: parsedTopics,
          summary: parsedSummary,
          suggestedQuestions: parsedSuggestedQuestions,
          userId: user.id,
        });

        if (!saveResult.success) {
          console.error(
            `[video-analysis] Failed to link cached video ${videoId} to user ${user.id}:`,
            saveResult.error
          );
        }
      }

      const shouldConsumeCachedCredit = Boolean(
        user &&
        !unlimitedAccess &&
        !alreadyCountedThisPeriod &&
        generationDecision?.subscription &&
        generationDecision.stats
      );

      if (shouldConsumeCachedCredit && user && generationDecision?.subscription && generationDecision.stats) {
        const consumeResult = await consumeVideoCreditAtomic({
          userId: user.id,
          youtubeId: videoId,
          subscription: generationDecision.subscription,
          statsSnapshot: generationDecision.stats,
          videoAnalysisId: cachedVideo.id,
          counted: true
        });

        if (!consumeResult.success) {
          console.error('Failed to consume cached video credit:', consumeResult.error);
        } else if (consumeResult.deduplicated) {
          console.log(`[video-analysis] Deduplicated credit for cached video ${videoId} (user: ${user.id})`);
        }
      }

      let themes: string[] = [];
      try {
        themes = await generateThemesFromTranscript(
          transcript,
          videoInfo,
          undefined,
          videoInfo?.language
        );
      } catch (error) {
        console.error('Error generating themes for cached video:', error);
      }

      // Ensure transcript is in merged format (backward compatibility for old cached videos)
      const originalTranscript = parsedTranscript || [];
      const migratedTranscript = ensureMergedFormat(originalTranscript, {
        enableLogging: true,
        context: `YouTube ID: ${videoId}`
      });

      const response = NextResponse.json({
        topics: parsedTopics,
        transcript: migratedTranscript,
        videoInfo: {
          title: cachedVideo.title,
          author: cachedVideo.author,
          duration: cachedVideo.duration,
          thumbnail: cachedVideo.thumbnailUrl
        },
        summary: parsedSummary,
        suggestedQuestions: parsedSuggestedQuestions,
        themes,
        cached: true,
        cacheDate: new Date(cachedVideo.createdAt * 1000).toISOString()
      });

      if (!user && guestState) {
        setGuestCookies(response, guestState);
      }

      return response;
    }

    // Generate new analysis
    const generationResult = await generateTopicsFromTranscript(
      transcript,
      {
        videoInfo,
        includeCandidatePool: validatedData.includeCandidatePool,
        excludeTopicKeys: new Set(validatedData.excludeTopicKeys ?? []),
        mode,
        language: videoInfo?.language
      }
    );
    const topics = generationResult.topics;
    const topicCandidates = generationResult.candidates;
    const modelUsed = generationResult.modelUsed;

    let themes: string[] = [];
    try {
      themes = await generateThemesFromTranscript(
        transcript,
        videoInfo,
        undefined,
        videoInfo?.language
      );
    } catch (error) {
      console.error('Error generating themes:', error);
    }

    // Save analysis to SQLite database FIRST (before consuming credit)
    const saveResult = await saveVideoAnalysisToSQLite({
      youtubeId: videoId,
      title: videoInfo?.title || `YouTube Video ${videoId}`,
      author: videoInfo?.author || null,
      duration: videoInfo?.duration ?? 0,
      thumbnailUrl: videoInfo?.thumbnail || null,
      transcript: transcript,
      topics: topics,
      summary: null, // Summary generated separately via /api/generate-summary
      suggestedQuestions: null,
      modelUsed: modelUsed,
      userId: user?.id || null,
      language: videoInfo?.language || null,
      availableLanguages: videoInfo?.availableLanguages || null
    });

    if (!saveResult.success) {
      // Log but don't fail the request - user should still see their results
      console.error(
        `[video-analysis] Failed to save new video ${videoId}:`,
        saveResult.error
      );
    }

    // Only consume credit AFTER successful save
    if (
      saveResult.success &&
      user &&
      !unlimitedAccess &&
      generationDecision?.subscription &&
      generationDecision.stats
    ) {
      const consumeResult = await consumeVideoCreditAtomic({
        userId: user.id,
        youtubeId: videoId,
        subscription: generationDecision.subscription,
        statsSnapshot: generationDecision.stats,
        videoAnalysisId: saveResult.videoId ?? undefined,
        counted: true
      });

      if (!consumeResult.success) {
        console.error('Failed to consume video credit:', consumeResult.error);
      } else if (consumeResult.deduplicated) {
        console.log(`[video-analysis] Deduplicated credit for new video ${videoId} (user: ${user.id})`);
      }
    }

    if (!user && guestState) {
      await recordGuestUsage(guestState);
    }

    const response = NextResponse.json({
      topics,
      themes,
      cached: false,
      topicCandidates: validatedData.includeCandidatePool
        ? topicCandidates ?? []
        : undefined,
      modelUsed
    });

    if (!user && guestState) {
      setGuestCookies(response, guestState, { markUsed: true });
    }

    return response;
  } catch (error) {
    // Log error details server-side only
    console.error('Error in video analysis:', error);

    // Return generic error message to client
    return respondWithNoCredits(
      { error: 'An error occurred while processing your request' },
      500
    );
  }
}

export const POST = withSecurity(handler, SECURITY_PRESETS.PUBLIC);
