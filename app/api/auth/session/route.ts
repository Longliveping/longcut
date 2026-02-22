import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/server'

export async function GET() {
  try {
    const session = await getSession()
    return NextResponse.json({ user: session?.user || null })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
