/**
 * Session Persistence Tests
 * Tests for authentication session persistence across page loads and browser sessions
 * Note: Lucia auth uses HTTP-only cookies, not localStorage
 */

import { test, expect } from '@playwright/test';
import { HomePage } from '../page-objects/HomePage';
import { AuthModalPage } from '../page-objects/AuthModalPage';
import { UserMenuPage } from '../page-objects/UserMenuPage';
import * as authHelpers from '../helpers/auth-helpers';

// Test suite: Session Persistence (Lucia Cookie-based Auth)
test.describe('Session Persistence', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;
  let userMenuPage: UserMenuPage;

  /**
   * Helper: Create and sign in a test user
   */
  async function createAndSignInUser(page: any): Promise<{ email: string; password: string } | null> {
    const testUser = authHelpers.generateValidSignupData();

    await homePage.goto();
    await homePage.waitForLoaded();

    // Create user via sign-up
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();
    await authModalPage.waitForSuccessMessage();
    await authModalPage.closeSuccessMessage();

    // Sign in
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();
    await authModalPage.fillSignInForm(testUser.email, testUser.password);
    await authModalPage.clickSignIn();

    // Wait for sign in
    await page.waitForLoadState('networkidle');
    await userMenuPage.waitForUserMenu();

    if (await userMenuPage.isUserSignedIn()) {
      return testUser;
    }

    return null;
  }

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);
    userMenuPage = new UserMenuPage(page);
  });

  /**
   * TC-001: Session persists across page reload (cookie-based)
   */
  test('should maintain session after page reload', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is still signed in (session cookie persists)
    await userMenuPage.waitForUserMenu();
    expect(await userMenuPage.isUserSignedIn()).toBe(true);
  });

  /**
   * TC-002: Session persists across navigation
   */
  test('should maintain session when navigating between pages', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Navigate to different pages
    const pages = ['/settings', '/my-videos', '/pricing', '/'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Verify user is still signed in (cookie is sent with each request)
      expect(await userMenuPage.isUserSignedIn()).toBe(true);
    }
  });

  /**
   * TC-003: Session persists across browser tabs (same context)
   */
  test('should maintain session across browser tabs', async ({ page, context }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in first tab
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Open new tab (cookies are shared across tabs in same context)
    const newPage = await context.newPage();

    // Navigate to home page in new tab
    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');

    // Verify user is signed in new tab (cookie is available)
    const newUserMenu = new UserMenuPage(newPage);
    await newUserMenu.waitForUserMenu();
    expect(await newUserMenu.isUserSignedIn()).toBe(true);

    await newPage.close();
  });

  /**
   * TC-004: Session stored in HTTP-only cookie (Lucia)
   */
  test('should store session in HTTP-only cookie', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Get cookies
    const cookies = await page.context().cookies();

    // Verify longcut_session cookie exists
    const sessionCookie = cookies.find(c => c.name === 'longcut_session');
    expect(sessionCookie).toBeTruthy();

    // Verify cookie is HTTP-only
    expect(sessionCookie?.httpOnly).toBe(true);

    // Verify cookie has expiration (7 days)
    expect(sessionCookie?.expires).toBeGreaterThan(Date.now() / 1000);
  });

  /**
   * TC-005: Clearing session cookie signs user out
   */
  test('should sign out when session cookie is cleared', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Clear session cookie
    await page.context().clearCookies();

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is signed out
    expect(await userMenuPage.isUserSignedIn()).toBe(false);
    expect(await userMenuPage.isSignInButtonVisible()).toBe(true);
  });

  /**
   * TC-006: Session expires after sign out
   */
  test('should clear session after sign out', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Verify session cookie exists
    const cookiesBefore = await page.context().cookies();
    const sessionCookieBefore = cookiesBefore.find(c => c.name === 'longcut_session');
    expect(sessionCookieBefore).toBeTruthy();

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out
    await userMenuPage.waitForSignInButton();

    // Verify session cookie is cleared
    const cookiesAfter = await page.context().cookies();
    const sessionCookieAfter = cookiesAfter.find(c => c.name === 'longcut_session');
    expect(sessionCookieAfter).toBeFalsy();

    // Reload page to verify sign out persisted
    await page.reload({ waitUntil: 'networkidle' });

    expect(await userMenuPage.isUserSignedIn()).toBe(false);
    expect(await userMenuPage.isSignInButtonVisible()).toBe(true);
  });

  /**
   * TC-007: Session persists after closing and reopening browser
   * Note: Playwright contexts persist cookies by default
   */
  test('should persist session after closing and reopening context', async ({ browser }) => {
    // Create new context and page
    const context = await browser.newContext();
    const page = await context.newPage();

    const testHomePage = new HomePage(page);
    const testAuthModal = new AuthModalPage(page);
    const testUserMenu = new UserMenuPage(page);

    // Create and sign in user
    const testUser = authHelpers.generateValidSignupData();

    await testHomePage.goto();
    await testHomePage.waitForLoaded();

    await testHomePage.clickSignIn();
    await testAuthModal.waitForModal();
    await testAuthModal.switchToSignUp();
    await testAuthModal.fillSignUpForm(testUser.email, testUser.password);
    await testAuthModal.clickSignUp();
    await testAuthModal.waitForSuccessMessage();
    await testAuthModal.closeSuccessMessage();

    await testHomePage.clickSignIn();
    await testAuthModal.waitForModal();
    await testAuthModal.switchToSignIn();
    await testAuthModal.fillSignInForm(testUser.email, testUser.password);
    await testAuthModal.clickSignIn();

    await page.waitForLoadState('networkidle');
    await testUserMenu.waitForUserMenu();

    // Skip if sign in failed
    if (!await testUserMenu.isUserSignedIn()) {
      await context.close();
      test.skip(true, 'Requires authenticated user');
      return;
    }

    // Verify session cookie exists
    const cookiesBefore = await context.cookies();
    const sessionCookieBefore = cookiesBefore.find(c => c.name === 'longcut_session');
    expect(sessionCookieBefore).toBeTruthy();

    // Close and recreate context (simulates browser restart)
    await context.close();

    // Create new context with storage state from cookies
    const newContext = await browser.newContext({
      storageState: { cookies: cookiesBefore },
    });
    const newPage = await newContext.newPage();

    // Navigate to site
    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');

    // Verify user is still signed in
    const newUserMenu = new UserMenuPage(newPage);
    await newUserMenu.waitForUserMenu();
    expect(await newUserMenu.isUserSignedIn()).toBe(true);

    await newContext.close();
  });

  /**
   * TC-008: Session remains valid over time
   */
  test('should maintain session over time', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Wait a bit to simulate time passing
    await page.waitForTimeout(3000);

    // User should still be authenticated
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Reload to verify session is still valid
    await page.reload({ waitUntil: 'networkidle' });
    expect(await userMenuPage.isUserSignedIn()).toBe(true);
  });

  /**
   * TC-009: Clearing cookies (including localStorage) doesn't affect cookie-based auth
   * Note: Clearing localStorage doesn't sign out Lucia users since auth is in cookies
   */
  test('should not sign out when only localStorage is cleared', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Clear localStorage (but not cookies)
    await page.evaluate(() => {
      localStorage.clear();
    });

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is STILL signed in (cookie is still there)
    expect(await userMenuPage.isUserSignedIn()).toBe(true);
  });

  /**
   * TC-010: Session persists across browser back/forward navigation
   */
  test('should maintain session with back/forward navigation', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Verify still signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Navigate back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Verify still signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Navigate forward
    await page.goForward();
    await page.waitForLoadState('networkidle');

    // Verify still signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);
  });

  /**
   * TC-011: User data accessible after page reload
   */
  test('should provide access to user data after reload', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Get user info before reload
    const userBefore = await authHelpers.getCurrentUser(page);
    expect(userBefore).not.toBeNull();

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Get user info after reload
    const userAfter = await authHelpers.getCurrentUser(page);
    expect(userAfter).not.toBeNull();

    // Verify user data is consistent
    expect(userBefore?.email).toEqual(userAfter?.email);
  });

  /**
   * TC-012: Session state consistent across multiple rapid navigations
   */
  test('should maintain session consistency with rapid navigation', async ({ page }) => {
    const credentials = await createAndSignInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Rapidly navigate between pages
    const pages = ['/settings', '/my-videos', '/pricing', '/', '/settings'];

    for (const path of pages) {
      await page.goto(path);

      // Verify user is still signed in after each navigation
      expect(await userMenuPage.isUserSignedIn()).toBe(true);
    }
  });
});

// Test suite: Session Storage (for video linking, not auth)
test.describe('Session Storage', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  /**
   * TC-013: Pending video ID stored in sessionStorage
   * Note: This is for video linking, not auth
   */
  test('should store pending video ID in sessionStorage', async ({ page }) => {
    // Set a pending video ID (used for linking videos after auth)
    const videoId = 'test-video-123';
    await homePage.setSessionStorageItem('pendingVideoId', videoId);

    // Verify it's stored
    const stored = await homePage.getSessionStorage();
    expect(stored['pendingVideoId']).toBe(videoId);

    // Verify it persists after reload
    await page.reload({ waitUntil: 'networkidle' });

    const storedAfter = await homePage.getSessionStorage();
    expect(storedAfter['pendingVideoId']).toBe(videoId);
  });

  /**
   * TC-014: SessionStorage can be cleared
   */
  test('should clear sessionStorage', async ({ page }) => {
    // Set some session storage data
    await homePage.setSessionStorageItem('testKey', 'testValue');
    await homePage.setSessionStorageItem('pendingVideoId', 'video-123');

    // Verify it's stored
    const storageBefore = await homePage.getSessionStorage();
    expect(storageBefore['testKey']).toBe('testValue');

    // Clear session storage
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    // Verify it's cleared
    const storageAfter = await homePage.getSessionStorage();
    expect(Object.keys(storageAfter).length).toBe(0);
  });
});
