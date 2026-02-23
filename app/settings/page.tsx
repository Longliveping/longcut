import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/server'
import { getUsageStats, getUserSubscriptionStatus } from '@/lib/subscription-manager'
import { db } from '@/lib/db'
import { userVideos } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'
import SettingsForm from './settings-form'

// Force dynamic rendering to prevent caching of subscription status
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage() {
  const session = await getSession()
  if (!session?.user) {
    redirect('/')
  }
  const user = session.user

  // Count user's videos
  const videoCountResult = await db
    .select({ count: count() })
    .from(userVideos)
    .where(eq(userVideos.userId, user.id))

  const videoCount = videoCountResult[0]?.count ?? 0

  // Always fetch subscription and usage for authenticated users
  const subscription = await getUserSubscriptionStatus(user.id)
  const usage = await getUsageStats(user.id)

  // Create subscription summary for all users (free and pro)
  const subscriptionSummary = subscription && usage
    ? {
        tier: subscription.tier,
        status: subscription.status,
        stripeCustomerId: subscription.stripeCustomerId,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        isPastDue: subscription.status === 'past_due',
        canPurchaseTopup: subscription.tier === 'pro',
        nextBillingDate: subscription.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd.getTime()).toISOString()
          : null,
        periodStart: new Date(usage.periodStart * 1000).toISOString(),
        periodEnd: new Date(usage.periodEnd * 1000).toISOString(),
        usage: {
          counted: usage.counted,
          cached: usage.cached,
          baseLimit: usage.baseLimit,
          baseRemaining: usage.baseRemaining,
          topupCredits: usage.topupCredits,
          topupRemaining: usage.topupRemaining,
          totalRemaining: usage.totalRemaining,
          resetAt: usage.resetAt,
        },
        willConsumeTopup: usage.baseRemaining <= 0 && usage.topupRemaining > 0,
      }
    : null

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      <SettingsForm
        user={user}
        videoCount={videoCount}
        subscription={subscriptionSummary}
      />
    </div>
  )
}
