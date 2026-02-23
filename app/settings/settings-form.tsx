'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { openBillingPortal as openPortalAction, startCheckout } from '@/lib/stripe-actions'
import { UsageIndicator } from '@/components/usage-indicator'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf-client'

interface User {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

type SubscriptionTier = 'free' | 'pro' | 'enterprise'
type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'unpaid' | null

interface SubscriptionSummary {
  tier: SubscriptionTier
  status: SubscriptionStatus
  stripeCustomerId: string | null
  cancelAtPeriodEnd: boolean
  isPastDue: boolean
  canPurchaseTopup: boolean
  nextBillingDate: string | null
  periodStart: string
  periodEnd: string
  usage: {
    counted: number
    cached: number
    baseLimit: number
    baseRemaining: number
    topupCredits: number
    topupRemaining: number
    totalRemaining: number
    resetAt: string
  }
  willConsumeTopup: boolean
}

interface SubscriptionStatusResponse {
  tier: SubscriptionTier
  status: SubscriptionStatus
  stripeCustomerId: string | null
  cancelAtPeriodEnd: boolean
  isPastDue: boolean
  canPurchaseTopup: boolean
  nextBillingDate: string | null
  period?: {
    start: string | null
    end: string | null
  } | null
  usage?: {
    counted: number
    cached: number
    baseLimit: number
    baseRemaining: number
    topupCredits: number
    topupRemaining: number
    totalRemaining: number
    resetAt: string
  } | null
  willConsumeTopup: boolean
}

function mapToSubscriptionSummary(payload: SubscriptionStatusResponse): SubscriptionSummary {
  return {
    tier: payload.tier,
    status: payload.status,
    stripeCustomerId: payload.stripeCustomerId,
    cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
    isPastDue: payload.isPastDue,
    canPurchaseTopup: payload.canPurchaseTopup,
    nextBillingDate: payload.nextBillingDate,
    periodStart: payload.period?.start ?? '',
    periodEnd: payload.period?.end ?? '',
    usage: {
      counted: payload.usage?.counted ?? 0,
      cached: payload.usage?.cached ?? 0,
      baseLimit: payload.usage?.baseLimit ?? 0,
      baseRemaining: payload.usage?.baseRemaining ?? 0,
      topupCredits: payload.usage?.topupCredits ?? 0,
      topupRemaining: payload.usage?.topupRemaining ?? 0,
      totalRemaining: payload.usage?.totalRemaining ?? 0,
      resetAt: payload.usage?.resetAt ?? '',
    },
    willConsumeTopup: payload.willConsumeTopup,
  }
}

interface SettingsFormProps {
  user: User
  videoCount: number
  subscription: SubscriptionSummary | null
}

function formatCancellationDate(periodEnd: string | null | undefined): string | null {
  if (!periodEnd) {
    return null
  }

  const cancellationDate = new Date(periodEnd)

  if (Number.isNaN(cancellationDate.valueOf())) {
    return null
  }

  return cancellationDate.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatStatus(subscription: SubscriptionSummary | null): string {
  if (!subscription) {
    return 'No subscription'
  }

  const { status, cancelAtPeriodEnd, periodEnd, nextBillingDate } = subscription

  if (cancelAtPeriodEnd) {
    const cancellationCopy = formatCancellationDate(nextBillingDate ?? periodEnd)
    return cancellationCopy ? `Cancels on ${cancellationCopy}` : 'Scheduled to cancel'
  }

  if (!status) {
    return 'No subscription'
  }

  switch (status) {
    case 'active':
      return 'Active'
    case 'past_due':
      return 'Past due'
    case 'canceled':
      return 'Canceled'
    case 'incomplete':
      return 'Incomplete'
    case 'trialing':
      return 'Trialing'
    default:
      return status
  }
}

export default function SettingsForm({ user, videoCount, subscription }: SettingsFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [billingAction, setBillingAction] = useState<'subscription' | 'topup' | 'portal' | null>(null)
  const [pendingSubscription, setPendingSubscription] = useState<SubscriptionSummary | null>(null)

  const currentSubscription = pendingSubscription ?? subscription

  useEffect(() => {
    if (subscription?.tier === 'pro') {
      setPendingSubscription(null)
    }
  }, [subscription?.tier])

  // Poll for subscription updates after Stripe checkout
  useEffect(() => {
    const sessionId = searchParams.get('session_id')

    if (!sessionId) return

    let pollInterval: NodeJS.Timeout | undefined
    let timeoutId: NodeJS.Timeout | undefined
    let processingToastShown = false
    let hasWelcomed = false

    const showProcessingToast = () => {
      if (!processingToastShown) {
        toast.loading('Processing your payment...', { id: 'stripe-processing' })
        processingToastShown = true
      }
    }

    const cleanupProcessing = () => {
      if (processingToastShown) {
        toast.dismiss('stripe-processing')
      }
      if (pollInterval) clearInterval(pollInterval)
      if (timeoutId) clearTimeout(timeoutId)
    }

    const fetchSubscriptionStatus = async (): Promise<SubscriptionSummary | null> => {
      try {
        const response = await fetch('/api/subscription/status', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        })

        if (!response.ok) return null

        const payload: SubscriptionStatusResponse = await response.json()
        return mapToSubscriptionSummary(payload)
      } catch (error) {
        console.error('Error fetching subscription status:', error)
        return null
      }
    }

    const syncSubscriptionSnapshot = async (summary?: SubscriptionSummary | null) => {
      const nextSummary = summary ?? await fetchSubscriptionStatus()

      if (nextSummary?.tier === 'pro') {
        setPendingSubscription(nextSummary)
      }

      return nextSummary ?? null
    }

    const handleActivation = (nextSummary?: SubscriptionSummary | null) => {
      cleanupProcessing()
      if (!hasWelcomed) {
        toast.success('Welcome to Pro! Your subscription is now active.')
        hasWelcomed = true
      }
      void syncSubscriptionSnapshot(nextSummary)
      router.refresh()
      window.history.replaceState({}, '', '/settings')
    }

    const handleTopupSuccess = (data: {
      creditsAdded?: number
      totalCredits?: number | null
      alreadyApplied?: boolean
      updated?: boolean
    }) => {
      cleanupProcessing()

      if (data.alreadyApplied) {
        toast.success('Top-Up credits already applied to your account.')
      } else if (data.updated && (data.creditsAdded ?? 0) > 0) {
        const totalCopy =
          typeof data.totalCredits === 'number'
            ? `You now have ${data.totalCredits} top-up credits available.`
            : 'Your credits are ready to use.'

        toast.success(
          `Added ${data.creditsAdded} Top-Up credits! ${totalCopy}`.trim()
        )
      } else {
        toast.success('Top-Up purchase recorded. Your credits will reflect shortly.')
      }

      void syncSubscriptionSnapshot()
      router.refresh()
      window.history.replaceState({}, '', '/settings')
    }

    const confirmCheckout = async (): Promise<'handled' | 'subscription_pending'> => {
      showProcessingToast()
      try {
        const response = await csrfFetch.post('/api/stripe/confirm-checkout', { sessionId })

        if (!response.ok) {
          return 'subscription_pending'
        }

        const data = await response.json()

        if (data.type === 'topup') {
          handleTopupSuccess(data)
          return 'handled'
        }

        if (data.type === 'subscription' || !data.type) {
          if (data.updated && data.tier === 'pro') {
            handleActivation()
            return 'handled'
          }

          return 'subscription_pending'
        }
      } catch (error) {
        console.error('Error confirming Stripe checkout:', error)
      }

      return 'subscription_pending'
    }

    const pollForSubscription = async () => {
      const summary = await fetchSubscriptionStatus()

      if (summary?.tier === 'pro') {
        handleActivation(summary)
      }
    }

    const startPolling = () => {
      showProcessingToast()
      pollForSubscription()
      pollInterval = setInterval(pollForSubscription, 2000)

      timeoutId = setTimeout(() => {
        cleanupProcessing()

        if (subscription?.tier !== 'pro') {
          toast.error('Payment processing is taking longer than expected. Please refresh the page in a moment.')
        }
      }, 30000)
    }

    ;(async () => {
      const result = await confirmCheckout()

      if (result === 'subscription_pending') {
        if (subscription?.tier === 'pro') {
          cleanupProcessing()
          window.history.replaceState({}, '', '/settings')
        } else {
          startPolling()
        }
      }
    })()

    return () => {
      cleanupProcessing()
    }
  }, [searchParams, subscription?.tier, router])

  const planLabel = currentSubscription?.tier === 'pro' ? 'Pro Plan' : 'Free Plan'
  const planStatus = formatStatus(currentSubscription)
  const isCancellationScheduled = Boolean(currentSubscription?.cancelAtPeriodEnd)
  const isPastDue = Boolean(currentSubscription?.isPastDue)
  const StatusIcon = isCancellationScheduled ? AlertCircle : isPastDue ? AlertCircle : Sparkles

  const handleCheckout = async (priceType: 'subscription' | 'topup') => {
    try {
      setBillingAction(priceType)
      await startCheckout(priceType)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error starting checkout'
      toast.error(message)
    } finally {
      setBillingAction(null)
    }
  }

  const openBillingPortal = async () => {
    try {
      setBillingAction('portal')
      await openPortalAction()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error opening billing portal'
      toast.error(message)
    } finally {
      setBillingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="text-sm">{user.email}</p>
          </div>
          {user.name && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-sm">{user.name}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Manage your subscription and billing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Details */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusIcon className="h-4 w-4" />
                <p className="font-semibold">{planLabel}</p>
              </div>
              <p className="text-sm text-muted-foreground">{planStatus}</p>
            </div>
            <Badge variant={currentSubscription?.tier === 'pro' ? 'default' : 'secondary'}>
              {currentSubscription?.tier === 'pro' ? 'Pro' : 'Free'}
            </Badge>
          </div>

          {isPastDue && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Past Due</AlertTitle>
              <AlertDescription>
                Your subscription payment is past due. Please update your payment method to avoid service interruption.
              </AlertDescription>
            </Alert>
          )}

          {/* Usage Indicator */}
          {currentSubscription && (
            <UsageIndicator
              counted={currentSubscription.usage.counted}
              baseLimit={currentSubscription.usage.baseLimit}
              baseRemaining={currentSubscription.usage.baseRemaining}
              topupRemaining={currentSubscription.usage.topupRemaining}
              resetAt={currentSubscription.usage.resetAt}
              warning={currentSubscription.isPastDue ? 'PAST_DUE' : null}
            />
          )}

          <Separator />

          {/* Billing Actions */}
          <div className="space-y-3">
            {currentSubscription?.tier === 'free' && (
              <Button
                onClick={() => handleCheckout('subscription')}
                disabled={billingAction === 'subscription'}
                className="w-full"
              >
                {billingAction === 'subscription' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upgrade to Pro
              </Button>
            )}

            {currentSubscription?.tier === 'pro' && (
              <>
                <Button
                  onClick={() => handleCheckout('topup')}
                  disabled={billingAction === 'topup'}
                  variant="outline"
                  className="w-full"
                >
                  {billingAction === 'topup' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Purchase Top-Up Credits
                </Button>
                <Button
                  onClick={openBillingPortal}
                  disabled={billingAction === 'portal'}
                  variant="outline"
                  className="w-full"
                >
                  {billingAction === 'portal' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Manage Billing
                </Button>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-xs text-muted-foreground">
            {videoCount} video{videoCount !== 1 ? 's' : ''} analyzed
          </p>
          {currentSubscription?.tier === 'pro' && (
            <Link
              href="/pricing"
              className="text-xs text-muted-foreground hover:underline"
            >
              View pricing
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
