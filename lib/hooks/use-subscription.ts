import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';

type SubscriptionStatusState =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | null;

export interface SubscriptionStatusResponse {
  tier: 'free' | 'pro';
  status: SubscriptionStatusState;
  stripeCustomerId?: string | null;
  cancelAtPeriodEnd?: boolean;
  isPastDue?: boolean;
  canPurchaseTopup?: boolean;
  nextBillingDate?: string | null;
  willConsumeTopup?: boolean;
  usage: {
    counted: number;
    cached: number;
    baseLimit: number;
    baseRemaining: number;
    topupCredits: number;
    topupRemaining: number;
    totalRemaining: number;
    resetAt: string;
  };
}

export function isProSubscriptionActive(status: SubscriptionStatusResponse | null): boolean {
  if (!status) {
    return false;
  }
  if (status.tier !== 'pro') {
    return false;
  }
  return status.status === 'active' || status.status === 'trialing' || status.status === 'past_due';
}

interface UseSubscriptionOptions {
  user: any;
  onAuthRequired?: () => void;
}

// Cooldown constants
const FAILURE_COOLDOWN = 60_000; // 1 minute before retrying after failure
const ERROR_TOAST_COOLDOWN = 60_000; // 1 minute between error toasts

export function useSubscription({ user, onAuthRequired }: UseSubscriptionOptions) {
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null);
  const subscriptionStatusFetchedAtRef = useRef<number | null>(null);
  const subscriptionStatusRef = useRef<SubscriptionStatusResponse | null>(null);
  const lastVisibleRef = useRef<number>(Date.now());
  const lastFailureTimeRef = useRef<number>(0);
  const lastErrorToastRef = useRef<number>(0);

  // Sync subscriptionStatus to ref for use in callback without dependency
  useEffect(() => {
    subscriptionStatusRef.current = subscriptionStatus;
  }, [subscriptionStatus]);

  // Track visibility changes to invalidate stale cache
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceHidden = Date.now() - lastVisibleRef.current;
        // If tab was hidden for over a minute, invalidate cache
        if (timeSinceHidden > 60_000) {
          subscriptionStatusFetchedAtRef.current = null;
        }
      } else if (document.visibilityState === 'hidden') {
        lastVisibleRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const fetchSubscriptionStatus = useCallback(
    async (options?: { force?: boolean }): Promise<SubscriptionStatusResponse | null> => {
      if (!user) {
        return null;
      }

      const now = Date.now();

      // If we failed recently and this isn't a forced refresh, bail early
      if (!options?.force && lastFailureTimeRef.current > 0) {
        const timeSinceFailure = now - lastFailureTimeRef.current;
        if (timeSinceFailure < FAILURE_COOLDOWN) {
          return subscriptionStatusRef.current;
        }
      }

      // Use ref for cache check to avoid dependency on subscriptionStatus
      const currentStatus = subscriptionStatusRef.current;
      const lastFetchedAt = subscriptionStatusFetchedAtRef.current;
      if (
        !options?.force &&
        currentStatus &&
        lastFetchedAt &&
        now - lastFetchedAt < 60_000
      ) {
        return currentStatus;
      }

      setIsCheckingSubscription(true);
      try {
        const response = await fetch('/api/subscription/status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });

        if (response.status === 401) {
          lastFailureTimeRef.current = Date.now();
          onAuthRequired?.();
          return null;
        }

        if (!response.ok) {
          lastFailureTimeRef.current = Date.now();
          const errorPayload = await response.json().catch(() => ({}));
          const message =
            typeof (errorPayload as { error?: string }).error === 'string'
              ? (errorPayload as { error?: string }).error!
              : 'Failed to check subscription status. Please try again.';
          // Debounce error toasts
          if (Date.now() - lastErrorToastRef.current > ERROR_TOAST_COOLDOWN) {
            toast.error(message);
            lastErrorToastRef.current = Date.now();
          }
          return null;
        }

        // Success - clear failure tracking
        lastFailureTimeRef.current = 0;
        const data: SubscriptionStatusResponse = await response.json();
        setSubscriptionStatus(data);
        subscriptionStatusFetchedAtRef.current = Date.now();
        return data;
      } catch (error) {
        console.error('Failed to fetch subscription status:', error);
        lastFailureTimeRef.current = Date.now();
        // Debounce error toasts
        if (Date.now() - lastErrorToastRef.current > ERROR_TOAST_COOLDOWN) {
          toast.error('Unable to check your subscription right now.');
          lastErrorToastRef.current = Date.now();
        }
        return null;
      } finally {
        setIsCheckingSubscription(false);
      }
    },
    [user, onAuthRequired]
  );

  useEffect(() => {
    subscriptionStatusFetchedAtRef.current = null;
    subscriptionStatusRef.current = null;
    lastFailureTimeRef.current = 0;
    lastErrorToastRef.current = 0;
    setSubscriptionStatus(null);
  }, [user]);

  return {
    subscriptionStatus,
    isCheckingSubscription,
    fetchSubscriptionStatus,
  };
}
