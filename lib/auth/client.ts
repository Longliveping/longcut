/**
 * Client-side authentication using Lucia
 * This provides a type-safe client for use in React components
 */

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const response = await fetch('/api/auth/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })

    let data
    try {
      data = await response.json()
    } catch {
      data = {}
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Sign in failed',
      }
    }

    return { success: true, user: data.user }
  } catch (error) {
    console.error('Sign-in fetch error:', error)
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    }
  }
}

/**
 * Sign up with email, password, and name
 */
export async function signUp(email: string, password: string, name: string) {
  try {
    const response = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password, name }),
    })

    let data
    try {
      data = await response.json()
    } catch {
      data = {}
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Sign up failed',
      }
    }

    return { success: true, user: data.user }
  } catch (error) {
    console.error('Sign-up fetch error:', error)
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    }
  }
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
