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
    
    const result = await auth.api.signUpEmail({
      body: {
        email: body.email,
        password: body.password,
        name: body.name,
      },
      headers: await headers(),
    })
    
    // Check for error in result
    if (result.error) {
      return Response.json(
        { error: result.error.message || 'Registration failed' },
        { status: 400 }
      )
    }
    
    return Response.json(result, { status: 201 })
  } catch (error) {
    console.error('Sign-up error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
