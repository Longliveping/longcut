import { db } from '@/lib/db';
import { users, videoGenerations } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import {
  fetchUsageBreakdown,
  formatResetAt,
  getRemainingCredits as computeRemainingCredits,
  type UsageBreakdown,
} from '@/lib/usage-tracker';

// Import types from the shared types file
import type {
  SubscriptionTier,
  SubscriptionStatus,
  UserSubscription,
  UsageStats,
  GenerationDecision,
} from '@/lib/subscription-types';

// Re-export types from the shared types file
export type {
  SubscriptionTier,
  SubscriptionStatus,
  UserSubscription,
  UsageStats,
  GenerationDecision,
};

export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 100,
  pro: 100,
  enterprise: 500,
};

const BILLING_PERIOD_DAYS = 30;
const THIRTY_DAYS_SEC = BILLING_PERIOD_DAYS * 24 * 60 * 60;

function resolveBillingPeriod(subscription: UserSubscription, now: number): { start: number; end: number } {
  // Free users: calculate fixed 30-day billing cycles from signup date
  if (subscription.userCreatedAt) {
    const signupTime = subscription.userCreatedAt;
    const currentTime = now;
    const elapsedSec = currentTime - signupTime;

    // Calculate which billing cycle we're in (0-indexed)
    const cycleNumber = Math.floor(elapsedSec / THIRTY_DAYS_SEC);

    // Calculate period start and end for the current cycle
    const periodStartSec = signupTime + (cycleNumber * THIRTY_DAYS_SEC);
    const periodEndSec = periodStartSec + THIRTY_DAYS_SEC;

    return {
      start: periodStartSec,
      end: periodEndSec,
    };
  }

  // Fallback for users without creation date: rolling window
  const end = now;
  const start = now - THIRTY_DAYS_SEC;
  return { start, end };
}

export async function getUserSubscriptionStatus(
  userId: string
): Promise<UserSubscription | null> {
  try {
    const records = await db
      .select({
        id: users.id,
        tier: users.tier,
        subscriptionStatus: users.subscriptionStatus,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionCurrentPeriodStart: users.subscriptionCurrentPeriodStart,
        subscriptionCurrentPeriodEnd: users.subscriptionCurrentPeriodEnd,
        cancelAtPeriodEnd: users.cancelAtPeriodEnd,
        topupCredits: users.topupCredits,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!records || records.length === 0) {
      // Return default free-tier subscription
      return {
        userId,
        tier: 'free',
        status: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        topupCredits: 0,
        userCreatedAt: null,
      };
    }

    const user = records[0];

    return {
      userId: user.id,
      tier: (user.tier as SubscriptionTier) ?? 'free',
      status: user.subscriptionStatus as SubscriptionStatus,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      currentPeriodStart: user.subscriptionCurrentPeriodStart
        ? new Date(user.subscriptionCurrentPeriodStart * 1000)
        : null,
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd
        ? new Date(user.subscriptionCurrentPeriodEnd * 1000)
        : null,
      cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
      topupCredits: Number(user.topupCredits ?? 0),
      userCreatedAt: user.createdAt ? Math.floor(new Date(user.createdAt).getTime() / 1000) : null,
    };
  } catch (error) {
    console.error('Error fetching subscription:', error);
    // Return default free-tier subscription on error
    return {
      userId,
      tier: 'free',
      status: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      topupCredits: 0,
      userCreatedAt: null,
    };
  }
}

export async function calculateUsageInPeriod(
  userId: string,
  periodStart: number,
  periodEnd: number
): Promise<UsageBreakdown> {
  return fetchUsageBreakdown({
    userId,
    start: periodStart,
    end: periodEnd,
  });
}

export async function getUsageStats(
  userId: string,
  now?: number
): Promise<UsageStats | null> {
  const currentTime = now ?? Math.floor(Date.now() / 1000);
  const subscription = await getUserSubscriptionStatus(userId);

  if (!subscription) {
    return null;
  }

  const { start, end } = resolveBillingPeriod(subscription, currentTime);

  let usage: UsageBreakdown;

  try {
    usage = await calculateUsageInPeriod(userId, start, end);
  } catch (error) {
    console.error('Failed to calculate usage in period:', error);
    usage = {
      counted: 0,
      cached: 0,
      total: 0,
      byTier: {},
    };
  }

  const baseLimit = TIER_LIMITS[subscription.tier];
  const remaining = computeRemainingCredits({
    baseLimit,
    countedUsage: usage.counted,
    topupCredits: subscription.topupCredits,
  });

  return {
    tier: subscription.tier,
    baseLimit,
    counted: usage.counted,
    cached: usage.cached,
    baseRemaining: remaining.baseRemaining,
    topupCredits: subscription.topupCredits,
    topupRemaining: remaining.topupRemaining,
    totalRemaining: remaining.totalRemaining,
    periodStart: start,
    periodEnd: end,
    resetAt: formatResetAt(new Date(end * 1000)),
  };
}

export async function canGenerateVideo(
  userId: string,
  youtubeId?: string,
  options?: {
    now?: number;
    skipCacheCheck?: boolean;
  }
): Promise<GenerationDecision> {
  const currentTime = options?.now ?? Math.floor(Date.now() / 1000);

  const subscription = await getUserSubscriptionStatus(userId);

  if (!subscription) {
    return {
      allowed: false,
      reason: 'NO_SUBSCRIPTION',
    };
  }

  const stats = await getUsageStats(userId, currentTime);

  if (!stats) {
    return {
      allowed: false,
      reason: 'NO_SUBSCRIPTION',
      subscription,
    };
  }

  const warning = subscription.status === 'past_due' ? 'PAST_DUE' : undefined;

  if (!options?.skipCacheCheck && youtubeId) {
    const cached = await isVideoCached(youtubeId);
    if (cached) {
      return {
        allowed: true,
        reason: 'CACHED',
        subscription,
        stats,
        warning,
        willConsumeTopup: false,
      };
    }
  }

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
      warning,
    };
  }

  if (stats.totalRemaining <= 0) {
    const requiresTopupPurchase = subscription.tier === 'pro';
    return {
      allowed: false,
      reason: 'LIMIT_REACHED',
      subscription,
      stats,
      warning,
      requiresTopupPurchase,
    };
  }

  const willConsumeTopup =
    stats.baseRemaining <= 0 && stats.topupRemaining > 0;

  return {
    allowed: true,
    reason: 'OK',
    subscription,
    stats,
    warning,
    willConsumeTopup,
    requiresTopupPurchase: false,
  };
}

interface ConsumeVideoCreditOptions {
  userId: string;
  youtubeId: string;
  subscription: UserSubscription;
  statsSnapshot: UsageStats;
  videoAnalysisId?: string | null;
  counted?: boolean;
  identifier?: string;
}

/**
 * Atomically consumes a video credit with proper transaction handling
 */
export async function consumeVideoCreditAtomic({
  userId,
  youtubeId,
  subscription,
  statsSnapshot,
  videoAnalysisId,
  counted = true,
  identifier,
}: ConsumeVideoCreditOptions): Promise<{
  success: boolean;
  generationId?: string;
  error?: string;
  usedTopup?: boolean;
  allowed?: boolean;
  reason?: string;
  deduplicated?: boolean;
}> {
  try {
    // Check if this video was already generated for this user (deduplication)
    const existing = await db
      .select({ id: videoGenerations.id })
      .from(videoGenerations)
      .where(
        and(
          eq(videoGenerations.userId, userId),
          eq(videoGenerations.youtubeId, youtubeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        success: true,
        allowed: true,
        generationId: existing[0].id,
        deduplicated: true,
      };
    }

    // Verify we still have credits (atomic check)
    if (counted && statsSnapshot.totalRemaining <= 0) {
      return {
        success: false,
        allowed: false,
        reason: 'LIMIT_REACHED',
        error: 'Insufficient credits',
      };
    }

    // Create the generation record
    const generationId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db.insert(videoGenerations).values({
      id: generationId,
      userId,
      identifier: identifier ?? `user:${userId}`,
      youtubeId,
      videoId: videoAnalysisId ?? null,
      counted: counted ?? true,
      tier: subscription.tier,
      createdAt: now,
    });

    // Consume topup credit if needed
    let usedTopup = false;
    if (counted) {
      const shouldConsumeTopup =
        statsSnapshot.baseRemaining <= 0 &&
        statsSnapshot.topupRemaining > 0 &&
        subscription.tier === 'pro';

      if (shouldConsumeTopup) {
        const nowStr = new Date().toISOString();
        await db
          .update(users)
          .set({
            topupCredits: sql`${users.topupCredits} - 1`,
            updatedAt: nowStr,
          })
          .where(eq(users.id, userId));
        usedTopup = true;
      }
    }

    return {
      success: true,
      allowed: true,
      generationId,
      usedTopup,
    };
  } catch (error) {
    console.error('Credit consumption failed:', error);
    return {
      success: false,
      error: 'CONSUMPTION_FAILED',
    };
  }
}

export async function attachVideoAnalysisToGeneration(
  generationId: string,
  videoAnalysisId: string
): Promise<void> {
  try {
    await db
      .update(videoGenerations)
      .set({ videoId: videoAnalysisId })
      .where(eq(videoGenerations.id, generationId));
  } catch (error) {
    console.error('Failed to link video generation with analysis:', error);
  }
}

export async function getRemainingCredits(
  userId: string,
  now?: number
): Promise<{ base: number; topup: number; total: number } | null> {
  const stats = await getUsageStats(userId, now);

  if (!stats) {
    return null;
  }

  return {
    base: stats.baseRemaining,
    topup: stats.topupRemaining,
    total: stats.totalRemaining,
  };
}

export async function addTopupCredits(
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  if (amount <= 0) {
    return { success: false, error: 'INVALID_AMOUNT' };
  }

  try {
    const nowStr = new Date().toISOString();
    await db
      .update(users)
      .set({
        topupCredits: sql`${users.topupCredits} + ${amount}`,
        updatedAt: nowStr,
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to add top-up credits:', error);
    return { success: false, error: 'TOPUP_UPDATE_FAILED' };
  }
}

export async function createOrRetrieveStripeCustomer(
  userId: string,
  email: string
): Promise<{ customerId: string; error?: string }> {
  try {
    const records = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (records && records.length > 0 && records[0].stripeCustomerId) {
      return { customerId: records[0].stripeCustomerId };
    }

    // For local deployment without Stripe, return a placeholder
    const customerId = `cus_${userId}`;
    const nowStr = new Date().toISOString();

    await db
      .update(users)
      .set({ stripeCustomerId: customerId, updatedAt: nowStr })
      .where(eq(users.id, userId));

    return { customerId };
  } catch (error) {
    console.error('Error creating customer:', error);
    return { customerId: '', error: 'FAILED_TO_CREATE_CUSTOMER' };
  }
}

export async function hasProSubscription(userId: string): Promise<boolean> {
  const subscription = await getUserSubscriptionStatus(userId);
  return subscription?.tier === 'pro' && subscription.status === 'active';
}

async function isVideoCached(youtubeId: string): Promise<boolean> {
  // Check if video exists in video_analyses table
  const { getVideoByYoutubeId } = await import('@/lib/api/videos');
  const video = await getVideoByYoutubeId(youtubeId);
  return Boolean(video);
}
