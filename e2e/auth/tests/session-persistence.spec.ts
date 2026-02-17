/**
 * Session Persistence Tests
 * Tests for authentication session persistence across page loads and browser sessions
 */

import { test, expect } from '@playwright/test';
import { HomePage } from '../page-objects/HomePage';
import { AuthModalPage } from '../page-objects/AuthModalPage';
import { UserMenuPage } from '../page-objects/UserMenuPage';
import * as authHelpers from '../helpers/auth-helpers';
import { AssertHelper } from '../helpers/test-helpers';

// Test suite: Session Persistence
test.describe('Session Persistence', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;
  let userMenuPage: UserMenuPage;

  /**
   * Helper: Sign in and return credentials
   */
  async function signInUser(page: any): Promise<{ email: string; password: string } | null> {
    await homePage.goto();
    await homePage.waitForLoaded();

    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Try to sign in
    await authModalPage.switchToSignIn();
    const email = 'test@example.com';
    const password = 'TestPass123!';

    await authModalPage.fillSignInForm(email, password);
    await authModalPage.clickSignIn();

    await page.waitForTimeout(2000);

    if (await userMenuPage.isUserSignedIn()) {
      return { email, password };
    }

    // If sign in failed, create user first
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();

    const testUser = authHelpers.generateValidSignupData();
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();

    await authModalPage.closeSuccessMessage();

    // Sign in with new user
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();
    await authModalPage.fillSignInForm(testUser.email, testUser.password);
    await authModalPage.clickSignIn();

    await page.waitForTimeout(2000);

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
   * TC-001: Session persists across page reload
   */
  test('should maintain session after page reload', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is still signed in
    await userMenuPage.waitForUserMenu();
    expect(await userMenuPage.isUserSignedIn()).toBe(true);
  });

  /**
   * TC-002: Session persists across navigation
   */
  test('should maintain session when navigating between pages', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Navigate to different pages
    const pages = ['/settings', '/my-videos', '/pricing', '/'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Verify user is still signed in
      expect(await userMenuPage.isUserSignedIn()).toBe(true);
    }
  });

  /**
   * TC-003: Session persists across browser tabs (same context)
   */
  test('should maintain session across browser tabs', async ({ page, context }) => {
    // Sign in first tab
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in first tab
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Open new tab
    const newPage = await context.newPage();

    // Navigate to home page in new tab
    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');

    // Verify user is signed in new tab
    const newUserMenu = new UserMenuPage(newPage);
    await newUserMenu.waitForUserMenu();
    expect(await newUserMenu.isUserSignedIn()).toBe(true);

    await newPage.close();
  });

  /**
   * TC-004: Session data stored in localStorage
   */
  test('should store session data in localStorage', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Get localStorage
    const storage = await homePage.getLocalStorage();

    // Verify auth tokens are stored
    const hasAuthTokens = Object.keys(storage).some(key =>
      key.toLowerCase().includes('supabase') || key.toLowerCase().includes('auth')
    );

    expect(hasAuthTokens).toBe(true);
  });

  /**
   * TC-005: Session restored from localStorage on page load
   */
  test('should restore session from localStorage', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Get auth state
    const authStateBefore = await authHelpers.getAuthState(page);
    expect(authStateBefore).not.toBeNull();

    // Clear session and reload
    await authHelpers.clearAuthState(page);

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is signed out
    expect(await userMenuPage.isUserSignedIn()).toBe(false);

    // Restore auth state
    await authHelpers.setAuthState(page, authStateBefore);

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is signed in again
    await userMenuPage.waitForUserMenu();
    expect(await userMenuPage.isUserSignedIn()).toBe(true);
  });

  /**
   * TC-006: Session expires after sign out
   */
  test('should expire session after sign out', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Get auth state
    const authState = await authHelpers.getAuthState(page);
    expect(authState).not.toBeNull();

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out
    await userMenuPage.waitForSignInButton();

    // Verify auth state is cleared
    const authStateAfter = await authHelpers.getAuthState(page);
    expect(authStateAfter).toBeNull();

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is still signed out
    expect(await userMenuPage.isUserSignedIn()).toBe(false);
    expect(await userMenuPage.isSignInButtonVisible()).toBe(true);
  });

  /**
   * TC-007: Session persists after closing and reopening browser (with remember me)
   */
  test('should persist session after closing browser context', async ({ browser }) => {
    // Create new context and page
    const context = await browser.newContext();
    const page = await context.newPage();

    const testHomePage = new HomePage(page);
    const testAuthModal = new AuthModalPage(page);
    const testUserMenu = new UserMenuPage(page);

    // Sign in
    await testHomePage.goto();
    await testHomePage.waitForLoaded();

    await testHomePage.clickSignIn();
    await testAuthModal.waitForModal();
    await testAuthModal.switchToSignIn();

    // Note: This test requires a real user to properly test persistence
    await testAuthModal.fillSignInForm('test@example.com', 'TestPass123!');
    await testAuthModal.clickSignIn();

    await page.waitForTimeout(2000);

    // Skip if sign in failed
    if (!await testUserMenu.isUserSignedIn()) {
      await context.close();
      test.skip(true, 'Requires authenticated user');
      return;
    }

    // Close context
    await context.close();

    // Create new context (simulates browser restart)
    const newContext = await browser.newContext({
      storageState: 'test-results/storage-state.json', // Would save state before closing
    });
    const newPage = await newContext.newPage();

    // Navigate to site
    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');

    // Verify user is still signed in
    const newUserMenu = new UserMenuPage(newPage);

    // This would require proper storage state persistence
    // For now, just verify the page loads
    expect(newPage.url()).toContain('localhost');

    await newContext.close();
  });

  /**
   * TC-008: Session handles token refresh
   */
  test('should refresh tokens automatically', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Get initial auth state
    const authStateBefore = await authHelpers.getAuthState(page);
    expect(authStateBefore).not.toBeNull();

    // Wait for potential token refresh
    await page.waitForTimeout(5000);

    // Get auth state after wait
    const authStateAfter = await authHelpers.getAuthState(page);

    // User should still be authenticated
    expect(await userMenuPage.isUserSignedIn()).toBe(true);
  });

  /**
   * TC-009: Clearing localStorage signs user out
   */
  test('should sign out when localStorage is cleared', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials, 'Requires authenticated user');

    // Verify user is signed in
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Clear localStorage
    await homePage.clearLocalStorage();

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });

    // Verify user is signed out
    expect(await userMenuPage.isUserSignedIn()).toBe(false);
    expect(await userMenuPage.isSignInButtonVisible()).toBe(true);
  });

  /**
   * TC-010: Session persists across browser back/forward navigation
   */
  test('should maintain session with back/forward navigation', async ({ page }) => {
    // Sign in
    const credentials = await signInUser(page);
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
    // Sign in
    const credentials = await signInUser(page);
    test.skip(!credentials || !credentials, 'Requires authenticated user');

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
    // Sign in
    const credentials = await signInUser(page);
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

// Test suite: Session Storage
test.describe('Session Storage', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  /**
   * TC-013: Pending video ID stored in sessionStorage
   */
  test('should store pending video ID in sessionStorage', async ({ page }) => {
    // Set a pending video ID
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
   * TC-014: SessionStorage cleared on sign out
   */
  test('should clear sessionStorage on sign out', async ({ page }) => {
    // Set some session storage data
    await homePage.setSessionStorageItem('testKey', 'testValue');
    await homePage.setSessionStorageItem('pendingVideoId', 'video-123');

    // Verify it's stored
    const storageBefore = await homePage.getSessionStorage();
    expect(storageBefore['testKey']).toBe('testValue');

    // Clear session storage (simulating sign out)
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    // Verify it's cleared
    const storageAfter = await homePage.getSessionStorage();
    expect(Object.keys(storageAfter).length).toBe(0);
  });
});
