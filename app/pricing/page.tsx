import { getSession } from '@/lib/auth/server'
import PricingContent from './pricing-content'
import { getUserSubscriptionStatus } from '@/lib/subscription-manager'
import type { SubscriptionStatus, SubscriptionTier } from '@/lib/subscription-types'

export default async function PricingPage() {
  let user = null
  const session = await getSession()
  user = session?.user ?? null

  let tier: SubscriptionTier | 'anonymous' = 'anonymous'
  let status: SubscriptionStatus = null
  let cancelAtPeriodEnd = false

  if (user) {
    tier = 'free'

    const subscription = await getUserSubscriptionStatus(user.id)
    if (subscription) {
      tier = subscription.tier
      status = subscription.status
      cancelAtPeriodEnd = subscription.cancelAtPeriodEnd
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <PricingContent
        isAuthenticated={Boolean(user)}
        tier={tier}
        status={status}
        cancelAtPeriodEnd={cancelAtPeriodEnd}
      />
    </div>
  )
}
