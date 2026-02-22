import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Basic validation
    if (!body.email || !body.password || !body.name) {
      return Response.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }
    
    const result = await auth.api.signUpEmail({
      body: {
        email: body.email,
        password: body.password,
        name: body.name,
      },
      headers: await headers(),
    })
    
    // Check if user was created successfully
    if (!result.user) {
      return Response.json(
        { error: 'Registration failed' },
        { status: 400 }
      )
    }
    
    return Response.json(result)
  } catch (error) {
    console.error('Sign-up error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
