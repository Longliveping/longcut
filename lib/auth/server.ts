import { auth } from './config'
import { headers } from 'next/headers'

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
}

export async function requireSession() {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}
