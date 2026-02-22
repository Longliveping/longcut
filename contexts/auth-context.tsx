'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { clearCSRFToken } from '@/lib/csrf-client'

interface User {
  user_metadata?: {
    avatar_url?: string
    full_name?: string
    name?: string
  }
  id: string
  email: string
  name?: string | null
  image?: string | null
  emailVerified?: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const lastVisibleRef = useRef<number>(Date.now())

  // Memoize session refresh to avoid recreating on every render
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Session refresh failed:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Memoize visibility handler to avoid recreating on every render
  const handleVisibilityChange = useCallback(async () => {
    if (document.visibilityState === 'visible') {
      const timeSinceHidden = Date.now() - lastVisibleRef.current

      // Only refresh session if tab was hidden for more than 30 seconds
      // This avoids unnecessary refreshes for quick tab switches
      if (timeSinceHidden > 30_000) {
        try {
          // Clear CSRF token cache - it may be stale after long background
          clearCSRFToken()

          // Refresh the session
          await refreshSession()
        } catch (err) {
          console.error('Unexpected error refreshing session:', err)
        }
      }
    } else if (document.visibilityState === 'hidden') {
      // Track when tab was hidden
      lastVisibleRef.current = Date.now()
    }
  }, [refreshSession])

  // Initial session fetch
  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  // Listen for tab visibility changes to refresh session (client-side only)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [handleVisibilityChange])

  const signIn = async (email: string, password: string) => {
    try {
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
          error: data.error || 'Sign in failed' 
        }
      }

      // Update user state with response
      if (data.user) {
        setUser(data.user)
      } else {
        // If no user returned, refresh session to get it
        await refreshSession()
      }

      return { success: true }
    } catch (error) {
      console.error('Sign in error:', error)
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      }
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    try {
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
          error: data.error || 'Sign up failed' 
        }
      }

      // Update user state with response
      if (data.user) {
        setUser(data.user)
      } else {
        // If no user returned, refresh session to get it
        await refreshSession()
      }

      return { success: true }
    } catch (error) {
      console.error('Sign up error:', error)
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      }
    }
  }

  const signOut = async () => {
    try {
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Sign out error:', error)
    }
    
    setUser(null)
    // Redirect to home page
    window.location.href = '/'
  }

  const value = useMemo(() => ({
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
  }), [user, loading, signIn, signUp, signOut, refreshSession])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
