import type { SubscriptionTier } from '@/lib/subscription-types';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimits } from '@/lib/db/schema';
import { eq, gte, lt, desc } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier?: string; // Custom identifier (user ID, IP, etc.)
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until next request allowed
}

export class RateLimiter {
  private static async getIdentifier(customId?: string): Promise<string> {
    if (customId) return customId;

    try {
      const session = await requireSession();
      const user = session.user;

      if (user) {
        return `user:${user.id}`;
      }
    } catch {
      // No user session, fall through to IP-based identification
    }

    // For anonymous users, use IP address hash
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';

    // Hash the IP for privacy
    const hash = crypto.createHash('sha256').update(ip).digest('hex');
    return `anon:${hash.substring(0, 16)}`;
  }

  static async peek(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const identifier = await this.getIdentifier(config.identifier);
    const rateLimitKey = `ratelimit:${key}:${identifier}`;

    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Count recent requests without modifying (using Unix timestamp)
      const windowStartSec = Math.floor(windowStart / 1000);

      const recentRequests = await db
        .select({ id: rateLimits.id, timestamp: rateLimits.timestamp })
        .from(rateLimits)
        .where(eq(rateLimits.key, rateLimitKey))
        .limit(1000); // Get recent entries to filter client-side

      const requestCount = recentRequests.filter(
        r => r.timestamp >= windowStartSec
      ).length;

      const remaining = Math.max(0, config.maxRequests - requestCount);
      const resetAt = new Date(now + config.windowMs);

      if (requestCount >= config.maxRequests) {
        // Calculate when the oldest request will expire
        const oldestRequest = recentRequests
          .filter(r => r.timestamp >= windowStartSec)
          .sort((a, b) => a.timestamp - b.timestamp)[0];

        let retryAfter = Math.ceil(config.windowMs / 1000);
        if (oldestRequest) {
          const oldestTime = oldestRequest.timestamp * 1000;
          retryAfter = Math.ceil((oldestTime + config.windowMs - now) / 1000);
        }

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter
        };
      }

      return {
        allowed: true,
        remaining,
        resetAt
      };
    } catch (error) {
      console.error('Rate limiter peek error:', error);
      // On error, allow the request but log it
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs)
      };
    }
  }

  static async check(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const identifier = await this.getIdentifier(config.identifier);
    const rateLimitKey = `ratelimit:${key}:${identifier}`;

    const now = Date.now();
    const windowStart = now - config.windowMs;
    const windowStartSec = Math.floor(windowStart / 1000);
    const nowSec = Math.floor(now / 1000);

    try {
      // First, clean up old entries (older than window)
      await db
        .delete(rateLimits)
        .where(lt(rateLimits.timestamp, windowStartSec));

      // Count recent requests
      const recentRequests = await db
        .select({ id: rateLimits.id, timestamp: rateLimits.timestamp })
        .from(rateLimits)
        .where(eq(rateLimits.key, rateLimitKey))
        .limit(1000);

      const requestCount = recentRequests.filter(
        r => r.timestamp >= windowStartSec
      ).length;

      const remaining = Math.max(0, config.maxRequests - requestCount);
      const resetAt = new Date(now + config.windowMs);

      if (requestCount >= config.maxRequests) {
        // Calculate when the oldest request will expire
        const oldestRequest = recentRequests
          .filter(r => r.timestamp >= windowStartSec)
          .sort((a, b) => a.timestamp - b.timestamp)[0];

        let retryAfter = Math.ceil(config.windowMs / 1000);
        if (oldestRequest) {
          const oldestTime = oldestRequest.timestamp * 1000;
          retryAfter = Math.ceil((oldestTime + config.windowMs - now) / 1000);
        }

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfter
        };
      }

      // Record this request
      await db.insert(rateLimits).values({
        id: crypto.randomUUID(),
        key: rateLimitKey,
        identifier,
        timestamp: nowSec
      });

      return {
        allowed: true,
        remaining: remaining - 1,
        resetAt
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request but log it
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(now + config.windowMs)
      };
    }
  }

  static async reset(key: string, identifier?: string): Promise<void> {
    const id = await this.getIdentifier(identifier);
    const rateLimitKey = `ratelimit:${key}:${id}`;

    await db.delete(rateLimits).where(eq(rateLimits.key, rateLimitKey));
  }
}

// Preset configurations for different endpoints
export const RATE_LIMITS = {
  // Anonymous users
  ANON_GENERATION: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 1 // 1 generation per day
  },
  ANON_CHAT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10 // 10 messages per minute
  },

  // Authenticated users (legacy - kept for backwards compatibility)
  AUTH_GENERATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20 // 20 generations per hour
  },
  AUTH_VIDEO_GENERATION: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 5 // 5 generations per day
  },
  AUTH_CHAT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30 // 30 messages per minute
  },

  // Suggested questions (lightweight, chat-like operation)
  SUGGESTED_QUESTIONS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20 // 20 requests per minute
  },

  // Subscription tier video generation limits (rolling 30-day window)
  VIDEO_GENERATION_FREE_UNREGISTERED: {
    windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxRequests: 0 // No video analysis for anonymous users
  },
  VIDEO_GENERATION_FREE_REGISTERED: {
    windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxRequests: 100 // 100 videos per 30 days for free registered users
  },
  VIDEO_GENERATION_PRO: {
    windowMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxRequests: 100 // 100 videos per 30 days for Pro subscribers
  },

  // General API endpoints
  API_GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60 // 60 requests per minute
  },

  // Sensitive operations
  AUTH_ATTEMPT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5 // 5 login attempts per 15 minutes
  },
  // Translation operations
  ANON_TRANSLATION: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100 // 100 API calls per minute for anonymous users (Google allows unlimited)
  },
  AUTH_TRANSLATION: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500 // 500 API calls per minute for authenticated users (Google allows unlimited)
  },
  // Read-only endpoints (status checks, etc.)
  READ_ONLY: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100 // 100 requests per minute
  }
};

// Helper function for API responses
export function rateLimitResponse(
  result: RateLimitResult
): NextResponse | null {
  const headers: HeadersInit = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString()
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();

    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
        resetAt: result.resetAt
      },
      {
        status: 429,
        headers
      }
    );
  }

  return null; // Request allowed
}

export function getPlanLimiter(
  tier: SubscriptionTier | 'anonymous'
): RateLimitConfig {
  switch (tier) {
    case 'pro':
      return RATE_LIMITS.VIDEO_GENERATION_PRO;
    case 'free':
      return RATE_LIMITS.VIDEO_GENERATION_FREE_REGISTERED;
    default:
      return RATE_LIMITS.VIDEO_GENERATION_FREE_UNREGISTERED;
  }
}
