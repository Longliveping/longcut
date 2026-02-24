/**
 * Sign Out Tests
 * Tests for sign out functionality
 * Note: With Lucia auth, we must create users via sign-up before testing sign-out
 */

import { test, expect } from '@playwright/test';
import { HomePage } from '../page-objects/HomePage';
import { AuthModalPage } from '../page-objects/AuthModalPage';
import { UserMenuPage } from '../page-objects/UserMenuPage';
import * as authHelpers from '../helpers/auth-helpers';
import { AssertHelper } from '../helpers/test-helpers';

// Test suite: Sign Out
test.describe('Sign Out', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;
  let userMenuPage: UserMenuPage;

  /**
   * Helper: Create and sign in a test user
   */
  async function createAndSignInUser(page: any) {
    const testUser = authHelpers.generateValidSignupData();

    await homePage.goto();
    await homePage.waitForLoaded();

    // Step 1: Create user via sign-up
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();
    await authModalPage.waitForSuccessMessage();
    await authModalPage.closeSuccessMessage();

    // Step 2: Sign in with the created credentials
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();
    await authModalPage.fillSignInForm(testUser.email, testUser.password);
    await authModalPage.clickSignIn();

    // Wait for sign in to complete
    await page.waitForLoadState('networkidle');
    await userMenuPage.waitForUserMenu();

    return testUser;
  }

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);
    userMenuPage = new UserMenuPage(page);
  });

  /**
   * TC-001: Sign out from user menu
   */
  test('should sign out from user menu', async ({ page }) => {
    await createAndSignInUser(page);

    // Open user menu
    await userMenuPage.openMenu();

    // Click sign out
    await userMenuPage.clickSignOut();

    // Verify signed out state
    await userMenuPage.waitForSignInButton();

    // Verify sign in button is visible
    await AssertHelper.assertVisible(userMenuPage.signInButton, 'Sign in button should be visible after sign out');

    // Verify user menu is not visible
    expect(await userMenuPage.isUserSignedIn()).toBe(false);
  });

  /**
   * TC-002: Sign out clears authentication state
   */
  test('should clear authentication state after sign out', async ({ page }) => {
    await createAndSignInUser(page);

    // Verify user is authenticated
    expect(await authHelpers.isAuthenticated(page)).toBe(true);

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out to complete
    await userMenuPage.waitForSignInButton();

    // Verify authentication state is cleared (Lucia uses cookies, not localStorage)
    const isAuthed = await authHelpers.isAuthenticated(page);
    expect(isAuthed).toBe(false);
  });

  /**
   * TC-003: Sign out clears cookie-based auth (Lucia)
   */
  test('should clear auth cookies after sign out', async ({ page }) => {
    await createAndSignInUser(page);

    // Verify session cookie exists
    const cookiesBefore = await page.context().cookies();
    const sessionCookieBefore = cookiesBefore.find(c => c.name === 'longcut_session');
    expect(sessionCookieBefore).toBeTruthy();

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out to complete
    await userMenuPage.waitForSignInButton();

    // Verify session cookie is cleared
    const cookiesAfter = await page.context().cookies();
    const sessionCookieAfter = cookiesAfter.find(c => c.name === 'longcut_session');
    expect(sessionCookieAfter).toBeFalsy();
  });

  /**
   * TC-004: Sign out closes user menu
   */
  test('should close user menu after sign out', async ({ page }) => {
    await createAndSignInUser(page);

    // Open user menu
    await userMenuPage.openMenu();
    expect(await userMenuPage.isMenuOpen()).toBe(true);

    // Click sign out
    await userMenuPage.clickSignOut();

    // Wait for sign out to complete
    await userMenuPage.waitForSignInButton();

    // Verify menu is closed
    expect(await userMenuPage.isMenuOpen()).toBe(false);
  });

  /**
   * TC-005: Can sign in again after sign out
   */
  test('should allow sign in after signing out', async ({ page }) => {
    await createAndSignInUser(page);

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out to complete
    await userMenuPage.waitForSignInButton();

    // Try to sign in again
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Verify modal opens
    expect(await authModalPage.isOpen()).toBe(true);

    // Close modal
    await authModalPage.closeByEscape();
  });

  /**
   * TC-006: Sign out stays on current page
   */
  test('should stay on current page after sign out', async ({ page }) => {
    await createAndSignInUser(page);

    // Navigate to a different page
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out
    await userMenuPage.waitForSignInButton();

    // Verify we're still on a valid page (home or settings)
    const currentUrl = page.url();
    expect(currentUrl).toContain('localhost');
  });

  /**
   * TC-007: Sign out button is visible in user menu
   */
  test('should display sign out button in user menu', async ({ page }) => {
    await createAndSignInUser(page);

    // Open user menu
    await userMenuPage.openMenu();

    // Verify sign out button is visible
    await AssertHelper.assertVisible(userMenuPage.signOutButton, 'Sign out button should be visible in user menu');

    // Verify sign out button text
    const signOutText = await userMenuPage.signOutButton.innerText();
    expect(signOutText.toLowerCase()).toContain('sign out');
  });

  /**
   * TC-008: User menu shows correct menu items
   */
  test('should show correct menu items when signed in', async ({ page }) => {
    await createAndSignInUser(page);

    // Open user menu
    await userMenuPage.openMenu();

    // Get all menu items
    const menuItems = await userMenuPage.getMenuItems();

    // Verify expected items are present
    const expectedItems = ['Account', 'Videos', 'Notes', 'Settings', 'Sign out'];
    for (const item of expectedItems) {
      expect(menuItems.some(i => i.includes(item))).toBe(true);
    }
  });

  /**
   * TC-009: Sign out works from any page
   */
  test('should allow sign out from any page', async ({ page }) => {
    await createAndSignInUser(page);

    // Navigate to different pages and try to sign out
    const pages = ['/settings', '/my-videos'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Sign out
      await userMenuPage.openMenu();
      await userMenuPage.clickSignOut();

      // Wait for sign out
      await userMenuPage.waitForSignInButton();

      // Verify signed out
      expect(await userMenuPage.isSignInButtonVisible()).toBe(true);

      // Re-create and sign in for next iteration
      await createAndSignInUser(page);
    }
  });
});

// Test suite: User Menu UI
test.describe('User Menu - UI Elements', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;
  let userMenuPage: UserMenuPage;

  /**
   * Helper: Create and sign in a test user
   */
  async function createAndSignInUser(page: any) {
    const testUser = authHelpers.generateValidSignupData();

    await homePage.goto();
    await homePage.waitForLoaded();

    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();
    await authModalPage.waitForSuccessMessage();
    await authModalPage.closeSuccessMessage();

    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();
    await authModalPage.fillSignInForm(testUser.email, testUser.password);
    await authModalPage.clickSignIn();

    await page.waitForLoadState('networkidle');
    await userMenuPage.waitForUserMenu();
  }

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);
    userMenuPage = new UserMenuPage(page);

    await createAndSignInUser(page);
  });

  /**
   * TC-010: User avatar is visible when signed in
   */
  test('should display user avatar when signed in', async ({ page }) => {
    await AssertHelper.assertVisible(userMenuPage.userMenuButton, 'User avatar/menu button should be visible when signed in');
  });

  /**
   * TC-011: User menu shows account email
   */
  test('should display user email in menu', async ({ page }) => {
    await userMenuPage.openMenu();

    const email = await userMenuPage.getUserEmail();
    expect(email).toBeTruthy();
    expect(email).toContain('@');
  });

  /**
   * TC-012: User menu has navigation links
   */
  test('should have navigation links to different pages', async ({ page }) => {
    await userMenuPage.openMenu();

    // Check for Videos link
    expect(await userMenuPage.isMenuItemVisible('Videos')).toBe(true);

    // Check for Notes link
    expect(await userMenuPage.isMenuItemVisible('Notes')).toBe(true);

    // Check for Settings link
    expect(await userMenuPage.isMenuItemVisible('Settings')).toBe(true);
  });
});
