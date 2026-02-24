import { cookies } from 'next/headers'

/**
 * Create a session cookie for Lucia
 * Since we're manually managing sessions, we use this to create the cookie value
 */
export function createSessionCookie(sessionId: string) {
  return {
    name: 'longcut_session',
    value: sessionId,
    attributes: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  }
}

/**
 * Get the current session from cookies
 * Note: We manually query the database since the adapter's validateSession has issues
 */
export async function getSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('longcut_session')?.value ?? null
  if (!sessionId) return null

  // Manually query the database for the session and user
  const { users, sessions } = await import('../db/schema')
  const { db } = await import('../db')
  const { eq, and, gte } = await import('drizzle-orm')

  const now = Math.floor(Date.now() / 1000)

  // Get session with user, filtering by expiration at database level
  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        gte(sessions.expiresAt, now) // Filter expired sessions at DB level
      )
    )
    .limit(1)

  if (result.length === 0) return null

  const sessionData = result[0]

  return {
    user: {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
      image: sessionData.user.image,
      emailVerified: Boolean(sessionData.user.emailVerified ?? 0),
    },
    session: {
      id: sessionData.session.id,
      expiresAt: sessionData.session.expiresAt,
      userId: sessionData.session.userId,
    },
  }
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireSession() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

/**
 * Type for the session user
 */
type SessionType = Awaited<ReturnType<typeof getSession>>
export type SessionUser = SessionType extends { user: infer U } ? U : never

/**
 * Empty session cookie for clearing
 */
export function createBlankSessionCookie() {
  return {
    name: 'longcut_session',
    value: '',
    attributes: {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 0,
    },
  }
}
