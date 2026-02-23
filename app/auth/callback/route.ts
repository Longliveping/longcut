import { resolveAppUrl } from '@/lib/utils'
import { NextResponse } from 'next/server'

/**
 * Auth callback route
 * For better-auth with email/password, this mainly handles
 * OAuth redirects (if configured) and error states
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const error = requestUrl.searchParams.get('error')
  const errorCode = requestUrl.searchParams.get('error_code')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const origin = resolveAppUrl(requestUrl.origin)

  // Handle OAuth and other auth errors
  if (error) {
    console.error('Auth error:', error, errorDescription, errorCode)

    // Handle specific error codes
    if (errorCode === 'otp_expired') {
      // Redirect to home with specific status for scanner-consumed links
      return NextResponse.redirect(`${origin}?auth_status=link_expired`)
    }

    // Redirect to home with generic error parameter
    return NextResponse.redirect(`${origin}?auth_error=${encodeURIComponent(errorDescription || error)}`)
  }

  // URL to redirect to after sign in process completes
  // The pending video will be linked via the useEffect in page.tsx
  return NextResponse.redirect(origin)
}
