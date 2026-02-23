import { auth } from '@/lib/auth/lucia'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { sessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(auth.sessionCookieName)

    if (!sessionCookie) {
      return NextResponse.json({ success: true })
    }

    // Manually delete session from database
    await db.delete(sessions).where(eq(sessions.id, sessionCookie.value))

    // Create blank session cookie to clear the cookie
    const blankCookie = auth.createBlankSessionCookie()
    cookieStore.set(
      blankCookie.name,
      blankCookie.value,
      blankCookie.attributes
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sign-out error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
