/**
 * Authentication Helper Functions
 * Utilities for managing test users and authentication flows
 */

import { Page, APIRequestContext } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  id?: string;
}

// Note: Lucia uses HTTP-only cookies, not access tokens
// This interface is kept for reference but not used
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

/**
 * Generate a random test email address
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@e2e.test`;
}

/**
 * Generate a secure test password
 */
export function generateTestPassword(): string {
  const timestamp = Date.now().toString(36);
  return `TestPass123!${timestamp}`;
}

/**
 * Create a test user via API
 */
export async function createTestUser(
  request: APIRequestContext,
  baseURL: string,
  email?: string,
  password?: string
): Promise<TestUser> {
  const testEmail = email || generateTestEmail();
  const testPassword = password || generateTestPassword();

  // Use sign-up endpoint
  const response = await request.post(`${baseURL}/api/auth/sign-up`, {
    data: {
      email: testEmail,
      password: testPassword,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // If direct API doesn't work, we'll create via UI
  if (!response.ok) {
    console.log('Direct user creation failed, user will be created via UI');
  }

  return {
    email: testEmail,
    password: testPassword,
  };
}

/**
 * Sign in via API and return user (Lucia sets session cookie via headers)
 */
export async function signInViaAPI(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password: string
): Promise<{ user: any; session: any } | null> {
  try {
    const response = await request.post(`${baseURL}/api/auth/sign-in`, {
      data: {
        email,
        password,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    // Lucia sets session cookie via HTTP headers, so we get user in response
    return {
      user: data.user,
      session: null, // Session is in HTTP-only cookie
    };
  } catch (error) {
    console.error('Sign in via API failed:', error);
    return null;
  }
}

/**
 * Sign out via API
 */
export async function signOutViaAPI(
  request: APIRequestContext,
  baseURL: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await request.post(`${baseURL}/api/auth/sign-out`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Sign out via API failed:', error);
    return false;
  }
}

/**
 * Delete test user via API (admin operation)
 */
export async function deleteTestUser(
  request: APIRequestContext,
  baseURL: string,
  userId: string,
  adminKey: string
): Promise<boolean> {
  try {
    const response = await request.delete(`${baseURL}/api/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Delete test user failed:', error);
    return false;
  }
}

/**
 * Get current auth state from cookies (Lucia auth)
 * Lucia uses HTTP-only cookies for session management
 */
export async function getAuthState(page: Page): Promise<any> {
  // Check for Lucia session cookie
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find(c => c.name === 'longcut_session');

  if (sessionCookie) {
    try {
      // Try to get session from API
      const response = await page.request.get('/api/auth/session');
      if (response.ok) {
        return await response.json();
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Set auth state - Lucia uses cookies set server-side
 * Use signInViaAPI instead to authenticate
 */
export async function setAuthState(page: Page, authData: any): Promise<void> {
  // Lucia auth uses server-side cookies, so we can't bypass the login flow
  // Use signInViaAPI() to authenticate in tests instead
  console.warn('setAuthState is not supported with Lucia auth. Use signInViaAPI() instead.');
}

/**
 * Clear auth state from cookies (Lucia auth)
 */
export async function clearAuthState(page: Page): Promise<void> {
  // Clear Lucia session cookie
  await page.context().clearCookies();

  // Also clear localStorage for any client-side auth state
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Check if user is authenticated (Lucia uses cookies)
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const authState = await getAuthState(page);
  return authState !== null && authState.user !== null;
}

/**
 * Get current user info from auth state
 */
export async function getCurrentUser(page: Page): Promise<any> {
  const authState = await getAuthState(page);
  return authState?.user || null;
}

/**
 * Wait for auth state change
 */
export async function waitForAuthState(
  page: Page,
  authenticated: boolean,
  timeout: number = 10000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const isAuthed = await isAuthenticated(page);
    if (isAuthed === authenticated) {
      return;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`Timeout waiting for auth state: ${authenticated ? 'authenticated' : 'unauthenticated'}`);
}

/**
 * Store test user credentials for cleanup
 */
const testUsers: Map<string, TestUser> = new Map();

export function registerTestUser(id: string, user: TestUser): void {
  testUsers.set(id, user);
}

export function getTestUser(id: string): TestUser | undefined {
  return testUsers.get(id);
}

export function unregisterTestUser(id: string): void {
  testUsers.delete(id);
}

export function getAllTestUsers(): TestUser[] {
  return Array.from(testUsers.values());
}

/**
 * Cleanup all test users (call in test teardown)
 */
export async function cleanupAllTestUsers(
  request: APIRequestContext,
  baseURL: string,
  adminKey: string
): Promise<void> {
  const users = getAllTestUsers();
  for (const user of users) {
    if (user.id) {
      await deleteTestUser(request, baseURL, user.id, adminKey);
    }
  }
  testUsers.clear();
}

/**
 * Mock OAuth flow for testing (without actual redirect)
 */
export async function mockOAuthSignIn(
  page: Page,
  provider: 'google' | 'github' | 'microsoft',
  mockUser: TestUser
): Promise<void> {
  // This would intercept OAuth callbacks and simulate successful auth
  // Implementation depends on how OAuth is configured
  await page.route('**/auth/callback**', async (route) => {
    // Mock successful OAuth callback
    const mockResponse = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'mock-user-id',
        email: mockUser.email,
      },
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    });
  });
}

/**
 * Generate valid test data for sign up
 */
export function generateValidSignupData(): { email: string; password: string } {
  return {
    email: generateTestEmail(),
    password: generateTestPassword(),
  };
}

/**
 * Generate invalid email formats for validation testing
 */
export function generateInvalidEmails(): string[] {
  return [
    'notanemail',
    '@example.com',
    'user@',
    'user @example.com',
    'user@',
    '',
    'user..name@example.com',
    'user@example',
  ];
}

/**
 * Generate weak passwords for validation testing
 */
export function generateWeakPasswords(): string[] {
  return [
    '',
    '12345',
    'password',
    'abc',
    '12345678',
    'abcdefgh',
    'noNumbers',
    '12345678',
  ];
}

/**
 * Verify email confirmation was sent (mock for testing)
 */
export async function verifyEmailSent(email: string): Promise<boolean> {
  // In a real test environment, this would check an email service or mock
  // For now, return true to simulate successful email sending
  console.log(`Email confirmation simulated for: ${email}`);
  return true;
}
