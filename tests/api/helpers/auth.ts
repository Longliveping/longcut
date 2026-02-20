// /root/workspace/longcut/tests/api/helpers/auth.ts
import { getTestDbClient } from './database'

export interface TestSession {
  user: any
  session: any
  accessToken: string
}

export class AuthHelper {
  static async createTestSession(): Promise<TestSession> {
    const timestamp = Date.now()
    const email = `test-${timestamp}@example.com`
    const password = 'test-password-123'

    const client = getTestDbClient()

    // Create user with admin API
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (error) throw error

    // Generate access token using signInWithPassword
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email,
      password
    })

    if (signInError) throw signInError

    return {
      user: data.user,
      session: signInData.session,
      accessToken: signInData.session.access_token
    }
  }

  static async getAuthenticatedCookies(session: TestSession): Promise<string> {
    return `sb-access-token=${session.accessToken}; sb-refresh-token=${session.session.refresh_token}`
  }

  static async createAnonymousSession() {
    return {
      cookies: 'guest-token=test-anonymous-token',
      userId: null
    }
  }

  static async cleanupTestUser(userId: string) {
    const client = getTestDbClient()
    await client.auth.admin.deleteUser(userId)
  }
}
