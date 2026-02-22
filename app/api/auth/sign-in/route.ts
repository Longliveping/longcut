import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const body = await req.json()
  const result = await auth.api.signInEmail({
    body: {
      email: body.email,
      password: body.password,
    },
    headers: await headers(),
  })
  return Response.json(result)
}
