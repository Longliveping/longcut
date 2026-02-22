import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  try {
    const result = await auth.api.signOut({
      headers: await headers(),
    })
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Sign-out error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
