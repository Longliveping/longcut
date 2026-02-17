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

  // Use Supabase admin API or sign-up endpoint
  const response = await request.post(`${baseURL}/api/auth/signup`, {
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
 * Sign in via API and return session
 */
export async function signInViaAPI(
  request: APIRequestContext,
  baseURL: string,
  email: string,
  password: string
): Promise<{ session: any; tokens: AuthTokens } | null> {
  try {
    const response = await request.post(`${baseURL}/api/auth/signin`, {
      data: {
        email,
        password,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      session: data.session,
      tokens: data.tokens,
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
    const response = await request.post(`${baseURL}/api/auth/signout`, {
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
 * Get current auth state from localStorage
 */
export async function getAuthState(page: Page): Promise<any> {
  return await page.evaluate(() => {
    // Check for Supabase auth tokens
    const supabaseAuth = localStorage.getItem('supabase.auth.token');
    if (supabaseAuth) {
      try {
        return JSON.parse(supabaseAuth);
      } catch {
        return null;
      }
    }
    return null;
  });
}

/**
 * Set auth state in localStorage (bypass UI login)
 */
export async function setAuthState(page: Page, authData: any): Promise<void> {
  await page.evaluate((data) => {
    localStorage.setItem('supabase.auth.token', JSON.stringify(data));
  }, authData);
}

/**
 * Clear auth state from localStorage and sessionStorage
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Clear sessionStorage
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth') || key.includes('pending'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const authState = await getAuthState(page);
  return authState !== null && authState.currentSession !== null;
}

/**
 * Get current user info from auth state
 */
export async function getCurrentUser(page: Page): Promise<any> {
  const authState = await getAuthState(page);
  return authState?.currentSession?.user || null;
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
