import { Lucia } from 'lucia'
import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle'
import { db } from '../db'
import * as schema from '../db/schema'
import { cookies } from 'next/headers'

export const auth = new Lucia({
  adapter: new DrizzleSQLiteAdapter(db, schema.users, schema.sessions),
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  getSessionAttributes: (attributes) => {
    return {
      userId: attributes.userId,
      emailVerified: Boolean(attributes.emailVerified ?? 0),
    }
  },
})

/**
 * Get the current session from cookies
 * Note: We manually query the database since the adapter's validateSession has issues
 */
export async function getSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(auth.sessionCookieName)?.value ?? null
  if (!sessionId) return null

  // Manually query the database for the session and user
  const { users, sessions } = await import('../db/schema')
  const { db } = await import('../db')
  const { eq, and } = await import('drizzle-orm')

  const now = Math.floor(Date.now() / 1000)

  // Get session with user
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
        eq(sessions.expiresAt, sessions.expiresAt) // Just to use sessions table
      )
    )
    .limit(1)

  if (result.length === 0) return null

  const sessionData = result[0]

  // Check if session is expired
  if (sessionData.session.expiresAt < now) {
    // Delete expired session
    await db.delete(sessions).where(eq(sessions.id, sessionId))
    return null
  }

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
export type SessionUser = Awaited<ReturnType<typeof getSession>>['user']
