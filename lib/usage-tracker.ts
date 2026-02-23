import { db } from '@/lib/db';
import { videoGenerations, users } from '@/lib/db/schema';
import { gte, lte, and, eq } from 'drizzle-orm';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface PeriodBounds {
  start: Date;
  end: Date;
}

export interface UsageBreakdown {
  counted: number;
  cached: number;
  total: number;
  byTier: Record<string, { counted: number; cached: number }>;
}

interface UsageInPeriodParams {
  userId: string;
  start: number; // Unix timestamp
  end: number; // Unix timestamp
}

/**
 * Returns the start and end of a rolling 30-day window from the given start date.
 */
export function getPeriodBounds(subStart: Date): PeriodBounds {
  const start = new Date(subStart);
  const end = new Date(start.getTime() + THIRTY_DAYS_MS);
  return { start, end };
}

/**
 * Aggregates usage for a user inside the provided window using SQLite.
 */
export async function fetchUsageBreakdown({
  userId,
  start,
  end,
}: UsageInPeriodParams): Promise<UsageBreakdown> {
  try {
    // Get user's tier from users table
    const userRecords = await db
      .select({ tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const user = userRecords[0];
    const tier = user?.tier ?? 'free';

    // Count generations in the period
    const generationRecords = await db
      .select({
        counted: videoGenerations.counted,
      })
      .from(videoGenerations)
      .where(
        and(
          eq(videoGenerations.userId, userId),
          gte(videoGenerations.createdAt, start),
          lte(videoGenerations.createdAt, end)
        )
      );

    let counted = 0;
    let cached = 0;

    for (const gen of generationRecords) {
      if (gen.counted) {
        counted += 1;
      } else {
        cached += 1;
      }
    }

    const breakdown: UsageBreakdown = {
      counted,
      cached,
      total: counted + cached,
      byTier: {
        [tier]: { counted, cached },
      },
    };

    return breakdown;
  } catch (error) {
    console.error('Failed to compute usage breakdown:', error);
    // Return empty breakdown on error
    return {
      counted: 0,
      cached: 0,
      total: 0,
      byTier: {},
    };
  }
}

interface RemainingCreditParams {
  baseLimit: number;
  countedUsage: number;
  topupCredits: number;
}

export interface RemainingCredits {
  baseRemaining: number;
  topupRemaining: number;
  totalRemaining: number;
}

/**
 * Calculates remaining credits given base usage, base limit, and stored top-up credits.
 */
export function getRemainingCredits({
  baseLimit,
  countedUsage,
  topupCredits,
}: RemainingCreditParams): RemainingCredits {
  const baseRemaining = Math.max(0, baseLimit - countedUsage);
  const topupRemaining = Math.max(0, topupCredits);
  return {
    baseRemaining,
    topupRemaining,
    totalRemaining: baseRemaining + topupRemaining,
  };
}

/**
 * Formats a reset timestamp for display and API responses.
 */
export function formatResetAt(date: Date): string {
  return date.toISOString();
}
