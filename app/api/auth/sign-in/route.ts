import { createSessionCookie } from '@/lib/auth/lucia'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { users, sessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { withSecurity } from '@/lib/security-middleware'
import { RATE_LIMITS } from '@/lib/rate-limiter'

async function handler(req: Request) {
  try {
    const body = await req.json()

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const email = body.email.toLowerCase().trim()

    // Find user
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const user = existing[0]

    // Verify password
    const isValid = await bcrypt.compare(body.password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create session manually (Lucia adapter doesn't support createSession)
    const sessionId = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    const now = new Date().toISOString()

    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    })

    const sessionCookie = createSessionCookie(sessionId)

    const cookieStore = await cookies()
    cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    })
  } catch (error) {
    console.error('Sign-in error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withSecurity(handler, {
  rateLimit: RATE_LIMITS.AUTH_ATTEMPT,
  maxBodySize: 1024, // 1KB - email + password
  allowedMethods: ['POST'],
  csrfProtection: false // Sign-in is a public endpoint, CSRF not needed
})
