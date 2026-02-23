import { db } from '@/lib/db';
import { imageGenerations, users } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { SubscriptionTier, UserSubscription } from '@/lib/subscription-types';
import { getUserSubscriptionStatus } from '@/lib/subscription-manager';

export interface ImageUsageStats {
  tier: SubscriptionTier;
  baseLimit: number;
  counted: number;
  baseRemaining: number;
  periodStart: number;
  periodEnd: number;
  resetAt: string;
}

export interface ImageGenerationDecision {
  allowed: boolean;
  reason: 'OK' | 'LIMIT_REACHED' | 'SUBSCRIPTION_INACTIVE' | 'NO_SUBSCRIPTION';
  subscription?: UserSubscription | null;
  stats?: ImageUsageStats | null;
}

export const IMAGE_TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 1,
  pro: 100,
  enterprise: 500,
};

const BILLING_PERIOD_DAYS = 30;
const THIRTY_DAYS_SEC = BILLING_PERIOD_DAYS * 24 * 60 * 60;

function resolveBillingPeriod(subscription: UserSubscription, now: number): { start: number; end: number } {
  // Free users: rolling 30-day windows anchored to signup
  if (subscription.userCreatedAt) {
    const signupTime = subscription.userCreatedAt;
    const elapsedSec = now - signupTime;
    const cycleNumber = Math.floor(elapsedSec / THIRTY_DAYS_SEC);
    const periodStartSec = signupTime + (cycleNumber * THIRTY_DAYS_SEC);
    const periodEndSec = periodStartSec + THIRTY_DAYS_SEC;
    return { start: periodStartSec, end: periodEndSec };
  }

  // Fallback: rolling 30 days
  const end = now;
  const start = now - THIRTY_DAYS_SEC;
  return { start, end };
}

async function fetchImageUsageInPeriod(
  userId: string,
  periodStart: number,
  periodEnd: number
): Promise<number> {
  try {
    const records = await db
      .select({ id: imageGenerations.id })
      .from(imageGenerations)
      .where(
        and(
          eq(imageGenerations.userId, userId),
          eq(imageGenerations.counted, true),
          gte(imageGenerations.createdAt, periodStart),
          lte(imageGenerations.createdAt, periodEnd)
        )
      );

    return records.length;
  } catch (error) {
    console.error('Failed to fetch image usage breakdown:', error);
    return 0;
  }
}

export async function getImageUsageStats(
  userId: string,
  now?: number
): Promise<ImageUsageStats | null> {
  const currentTime = now ?? Math.floor(Date.now() / 1000);
  const subscription = await getUserSubscriptionStatus(userId);

  if (!subscription) {
    return null;
  }

  const { start, end } = resolveBillingPeriod(subscription, currentTime);
  const baseLimit = IMAGE_TIER_LIMITS[subscription.tier as SubscriptionTier];

  const counted = await fetchImageUsageInPeriod(userId, start, end);
  const baseRemaining = Math.max(0, baseLimit - counted);

  return {
    tier: subscription.tier,
    baseLimit,
    counted,
    baseRemaining,
    periodStart: start,
    periodEnd: end,
    resetAt: new Date(end * 1000).toISOString(),
  };
}

export async function canGenerateImage(
  userId: string,
  now?: number
): Promise<ImageGenerationDecision> {
  const currentTime = now ?? Math.floor(Date.now() / 1000);
  const subscription = await getUserSubscriptionStatus(userId);

  if (!subscription) {
    return { allowed: false, reason: 'NO_SUBSCRIPTION' };
  }

  const stats = await getImageUsageStats(userId, currentTime);

  if (!stats) {
    return {
      allowed: false,
      reason: 'NO_SUBSCRIPTION',
      subscription,
      stats: null,
    };
  }

  // Pro users must be active/trialing/past_due; otherwise block
  if (
    subscription.tier === 'pro' &&
    subscription.status &&
    !['active', 'trialing', 'past_due'].includes(subscription.status)
  ) {
    return {
      allowed: false,
      reason: 'SUBSCRIPTION_INACTIVE',
      subscription,
      stats,
    };
  }

  if (stats.baseRemaining <= 0) {
    return {
      allowed: false,
      reason: 'LIMIT_REACHED',
      subscription,
      stats,
    };
  }

  return {
    allowed: true,
    reason: 'OK',
    subscription,
    stats,
  };
}

export async function consumeImageCreditAtomic({
  userId,
  youtubeId,
  subscription,
  statsSnapshot,
  videoAnalysisId,
  counted = true,
}: {
  userId: string;
  youtubeId: string;
  subscription: UserSubscription;
  statsSnapshot: ImageUsageStats;
  videoAnalysisId?: string | null;
  counted?: boolean;
}): Promise<{ success: boolean; generationId?: string; error?: string }> {
  try {
    // Check if this video was already generated (deduplication)
    const existing = await db
      .select({ id: imageGenerations.id })
      .from(imageGenerations)
      .where(
        and(
          eq(imageGenerations.userId, userId),
          eq(imageGenerations.youtubeId, youtubeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: true, generationId: existing[0].id };
    }

    // Verify we still have credits
    if (counted && statsSnapshot.baseRemaining <= 0) {
      return { success: false, error: 'LIMIT_REACHED' };
    }

    // Create the generation record
    const generationId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(imageGenerations).values({
      id: generationId,
      userId,
      youtubeId,
      videoId: videoAnalysisId ?? null,
      counted: counted ?? true,
      tier: subscription.tier,
      createdAt: now,
    });

    return { success: true, generationId };
  } catch (error) {
    console.error('Atomic image credit consumption failed:', error);
    return { success: false, error: 'CONSUMPTION_FAILED' };
  }
}
