import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();

  // Sign out using better-auth
  await auth.api.signOut({
    headers: new Headers({
      cookie: cookieStore.toString(),
    }),
  });

  // Clear all session cookies
  const response = NextResponse.json({ success: true });

  // Delete all auth-related cookies
  const allCookies = cookieStore.getAll();
  allCookies.forEach((cookie) => {
    if (
      cookie.name.startsWith('better-auth.') ||
      cookie.name.startsWith('session_token') ||
      cookie.name.startsWith('sb-')
    ) {
      response.cookies.delete(cookie.name);
    }
  });

  return response;
}
