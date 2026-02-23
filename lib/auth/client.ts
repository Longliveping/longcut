/**
 * Client-side authentication using Lucia
 * This provides a type-safe client for use in React components
 */

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const response = await fetch('/api/auth/sign-in', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  const data = await response.json()

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Sign in failed',
    }
  }

  return { success: true, user: data.user }
}

/**
 * Sign up with email, password, and name
 */
export async function signUp(email: string, password: string, name: string) {
  const response = await fetch('/api/auth/sign-up', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password, name }),
  })

  const data = await response.json()

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Sign up failed',
    }
  }

  return { success: true, user: data.user }
}

/**
 * Sign out
 */
export async function signOut() {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Sign out failed')
  }

  // Reload page to clear local state
  window.location.href = '/'
}
