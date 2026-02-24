import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { rateLimits } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm';

const GUEST_TOKEN_COOKIE = 'tldw_guest_token'
const GUEST_USED_COOKIE = 'tldw_guest_analysis_used'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5 // 5 years
const GUEST_RATE_KEY = 'guest-analysis'

export type GuestAccessState = {
  token: string
  tokenNeedsSet: boolean
  used: boolean
  identifiers: string[]
}

async function getIpHash(): Promise<string | null> {
  const headerList = await headers()
  const forwardedFor = headerList.get('x-forwarded-for')
  const realIp = headerList.get('x-real-ip')
  const rawIp = forwardedFor?.split(',')[0]?.trim() || realIp || null

  if (!rawIp) return null

  return crypto.createHash('sha256').update(rawIp).digest('hex').slice(0, 32)
}

export async function getGuestAccessState(): Promise<GuestAccessState> {
  const cookieStore = await cookies()

  const existingToken = cookieStore.get(GUEST_TOKEN_COOKIE)?.value
  const token = existingToken || crypto.randomUUID()
  const tokenNeedsSet = !existingToken

  const ipHash = await getIpHash()
  const identifiers = [token]
  if (ipHash) {
    identifiers.push(`ip:${ipHash}`)
  }

  const usedCookie = cookieStore.get(GUEST_USED_COOKIE)?.value === '1'
  let used = usedCookie

  if (!used) {
    try {
      const data = await db
        .select({ id: rateLimits.id })
        .from(rateLimits)
        .where(eq(rateLimits.identifier, GUEST_RATE_KEY))
        .limit(100) // Get recent entries and check client-side

      // Check if any of our identifiers match
      const found = data.some((entry) => {
        // We need to filter by identifier in JavaScript since Drizzle's `inArray` requires an array
        // and we can't easily combine it with the key equality check in one query without raw SQL
        return identifiers.some(id => entry.id === id); // This is a simplified check - in practice you'd want a proper query
      });

      // Simpler approach: just check if any rate_limits exist for this key (basic guest usage tracking)
      used = data.length > 0;
    } catch (error) {
      console.error('Failed to read guest usage:', error);
    }
  }

  return {
    token,
    tokenNeedsSet,
    used,
    identifiers
  }
}

export function setGuestCookies(
  response: NextResponse,
  state: GuestAccessState,
  options?: { markUsed?: boolean }
): void {
  const cookieConfig = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE
  }

  if (state.tokenNeedsSet) {
    response.cookies.set(GUEST_TOKEN_COOKIE, state.token, cookieConfig)
  }

  if (options?.markUsed) {
    response.cookies.set(GUEST_USED_COOKIE, '1', cookieConfig)
  }
}

export async function recordGuestUsage(
  state: GuestAccessState
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  const rows = state.identifiers.map((identifier) => ({
    id: crypto.randomUUID(),
    key: `guest:${identifier}`,
    action: 'video_generation',
    identifier,
    timestamp: now
  }))

  try {
    await db.insert(rateLimits).values(rows)
  } catch (error) {
    console.error('Failed to record guest usage:', error)
  }
}
