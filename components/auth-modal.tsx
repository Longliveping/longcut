'use client'

import { useState } from 'react'
import { resolveAppUrl } from '@/lib/utils'
import { useInAppBrowser } from '@/lib/hooks/use-in-app-browser'
import { Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { signIn, signUp } from '@/lib/auth/client'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  trigger?: 'generation-limit' | 'save-video' | 'manual' | 'save-note'
  currentVideoId?: string | null
}

export function AuthModal({ open, onOpenChange, onSuccess, trigger = 'manual', currentVideoId }: AuthModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const appUrl = resolveAppUrl(typeof window !== 'undefined' ? window.location.origin : undefined)
  const isInApp = useInAppBrowser()

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied! Paste it in Chrome, Safari, or Firefox.')
  }

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await signUp(email, password, 'User')

      if (!result.success) {
        setError(result.error ?? 'Signup failed')
        toast.error(result.error ?? 'Signup failed')
      } else {
        setSuccess(true)
        toast.success('Account created! Please sign in.')
      }
    } catch (error) {
      console.error('Sign-up error:', error)
      setError('Network error. Please try again.')
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)

    try {
      // Store current video ID in sessionStorage before signing in
      if (currentVideoId) {
        sessionStorage.setItem('pendingVideoId', currentVideoId)
      }

      const result = await signIn(email, password)

      if (!result.success) {
        setError(result.error ?? 'Sign in failed')
        toast.error(result.error ?? 'Sign in failed')
      } else {
        toast.success('Successfully signed in!')
        onSuccess?.()
        onOpenChange(false)
        // Reload to update auth state
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }
    } catch (error) {
      console.error('Sign-in error:', error)
      setError('Network error. Please try again.')
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getModalContent = () => {
    switch (trigger) {
      case 'generation-limit':
        return {
          title: 'Sign up to continue',
          description: 'You\'ve used your free preview. Create a free account to unlock monthly credits.',
          benefits: [
            '5 video analyses every 30 days',
            'Save videos, notes, and highlights across devices',
            'Upgrade anytime for 100 videos/month + Top-Up credits',
          ],
          showBenefitsCard: true,
        }
      case 'save-note':
        return {
          title: 'Sign in to save notes',
          description: 'Capture key moments and keep your highlights in one place.',
          benefits: [
            'Save transcript snippets with one click',
            'Organize notes across every video',
            'Access your highlights from any device',
          ],
          showBenefitsCard: true,
        }
      default:
        return {
          title: 'Sign in to LongCut',
          description: 'Create an account or sign in to save your video analyses and access them anytime.',
          benefits: [
            'Save your analyzed videos',
            'Access your video library from any device',
            'Track your learning progress',
          ],
          showBenefitsCard: false,
        }
    }
  }

  const { title, description, benefits, showBenefitsCard } = getModalContent()

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Account created!
            </DialogTitle>
            <DialogDescription className="pt-2">
              Your account has been created with <strong>{email}</strong>.
              You can now sign in to continue.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => {
            setSuccess(false)
            onOpenChange(false)
          }} className="w-full">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {showBenefitsCard && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">What you get with a free account:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSignIn}
                disabled={loading || !email || !password}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSignUp}
                disabled={loading || !email || !password || password.length < 6}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
