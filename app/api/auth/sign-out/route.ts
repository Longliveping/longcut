import { auth } from '@/lib/auth/config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const result = await auth.api.signOut({
    headers: await headers(),
  })
  return Response.json(result)
}
