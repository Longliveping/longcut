/**
 * Subscription types that can be safely imported by both client and server code
 */

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | null;

export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  topupCredits: number;
  userCreatedAt: number | null; // Unix timestamp
}

export interface UsageStats {
  tier: SubscriptionTier;
  baseLimit: number;
  counted: number;
  cached: number;
  baseRemaining: number;
  topupCredits: number;
  topupRemaining: number;
  totalRemaining: number;
  periodStart: number;
  periodEnd: number;
  resetAt: string;
}

export interface GenerationDecision {
  allowed: boolean;
  reason: 'OK' | 'CACHED' | 'LIMIT_REACHED' | 'SUBSCRIPTION_INACTIVE' | 'NO_SUBSCRIPTION';
  subscription?: UserSubscription | null;
  stats?: UsageStats | null;
  warning?: 'PAST_DUE';
  willConsumeTopup?: boolean;
  requiresTopupPurchase?: boolean;
}
