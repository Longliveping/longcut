import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Basic validation
    if (!body.email || !body.password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    
    const result = await auth.api.signInEmail({
      body: {
        email: body.email,
        password: body.password,
      },
      headers: await headers(),
    })
    
    // Check if user exists (successful authentication)
    if (!result.user) {
      return Response.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }
    
    return Response.json(result)
  } catch (error) {
    console.error('Sign-in error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
