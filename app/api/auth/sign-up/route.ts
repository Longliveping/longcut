import { auth } from '@/lib/auth/lucia'
import { cookies } from 'next/headers'
import { generateId } from 'lucia'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { users, sessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const email = body.email.toLowerCase().trim()

    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hash(body.password, 10)

    // Create user
    const userId = generateId(15)
    const now = new Date().toISOString()

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      name: body.name ?? null,
      emailVerified: 0,
      createdAt: now,
      updatedAt: now,
      tier: 'free',
      topupCredits: 0,
      cancelAtPeriodEnd: 0,
    })

    // Create session manually (Lucia adapter doesn't support createSession)
    const sessionId = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days

    await db.insert(sessions).values({
      id: sessionId,
      userId: userId,
      expiresAt: expiresAt,
      createdAt: now,
      updatedAt: now,
    })

    const sessionCookie = auth.createSessionCookie(sessionId)

    const cookieStore = await cookies()
    cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes)

    return NextResponse.json({
      user: {
        id: userId,
        email,
        name: body.name ?? null,
      }
    })
  } catch (error) {
    console.error('Sign-up error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
