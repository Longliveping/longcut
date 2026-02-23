import { NextRequest, NextResponse } from 'next/server';
import { withSecurity, SECURITY_PRESETS } from '@/lib/security-middleware';
import { getUserSubscriptionStatus, getUsageStats } from '@/lib/subscription-manager';
import { requireSession } from '@/lib/auth/server';

/**
 * GET /api/subscription/status
 *
 * Returns the current user's subscription status, usage statistics, and limits
 *
 * Response:
 * {
 *   tier: 'free' | 'pro',
 *   status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing' | null,
 *   usage: {
 *     used: number,
 *     limit: number,
 *     topupCredits: number,
 *     remaining: number
 *   },
 *   period: {
 *     start: string (ISO date),
 *     end: string (ISO date)
 *   },
 *   cancelAtPeriodEnd: boolean,
 *   stripeCustomerId: string | null
 * }
 */
async function handler(_req: NextRequest) {
  try {
    // Get authenticated user
    const session = await requireSession();
    const user = session.user;

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get subscription status
    const subscription = await getUserSubscriptionStatus(user.id);

    if (!subscription) {
      return NextResponse.json(
        { error: 'Unable to fetch subscription status' },
        { status: 500 }
      );
    }

    // Get usage statistics
    const stats = await getUsageStats(user.id);

    if (!stats) {
      return NextResponse.json(
        { error: 'Unable to fetch usage statistics' },
        { status: 500 }
      );
    }

    const nextBillingDate = subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd.getTime()).toISOString()
      : null;

    const willConsumeTopup = stats.baseRemaining <= 0 && stats.topupRemaining > 0;

    return NextResponse.json({
      tier: subscription.tier,
      status: subscription.status,
      stripeCustomerId: subscription.stripeCustomerId,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      isPastDue: subscription.status === 'past_due',
      canPurchaseTopup: subscription.tier === 'pro',
      nextBillingDate,
      period: {
        start: new Date(stats.periodStart * 1000).toISOString(),
        end: new Date(stats.periodEnd * 1000).toISOString(),
      },
      usage: {
        counted: stats.counted,
        cached: stats.cached,
        baseLimit: stats.baseLimit,
        baseRemaining: stats.baseRemaining,
        topupCredits: stats.topupCredits,
        topupRemaining: stats.topupRemaining,
        totalRemaining: stats.totalRemaining,
        resetAt: stats.resetAt,
      },
      willConsumeTopup,
    }, {
      headers: {
        // Allow caching for 30 seconds to reduce database load during polling
        'Cache-Control': 'private, max-age=30, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error in subscription status API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}

export const GET = withSecurity(handler, SECURITY_PRESETS.AUTHENTICATED_READ_ONLY);
