/**
 * Sign Out Tests
 * Tests for sign out functionality
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
   * Helper: Sign in before each test
   */
  async function signInUser(page: any) {
    await homePage.goto();
    await homePage.waitForLoaded();

    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign in tab
    await authModalPage.switchToSignIn();

    // Fill in credentials
    // Note: In real implementation, use valid test user
    await authModalPage.fillSignInForm('test@example.com', 'TestPass123!');

    // Submit
    await authModalPage.clickSignIn();

    // Wait for sign in
    await page.waitForTimeout(2000);

    // If sign in failed (test user doesn't exist), create user first
    if (!await userMenuPage.isUserSignedIn()) {
      // Open modal again
      await homePage.clickSignIn();
      await authModalPage.waitForModal();
      await authModalPage.switchToSignUp();

      // Create user
      const testUser = authHelpers.generateValidSignupData();
      await authModalPage.fillSignUpForm(testUser.email, testUser.password);
      await authModalPage.clickSignUp();

      // Close success message
      await authModalPage.closeSuccessMessage();

      // Sign in with new user
      await homePage.clickSignIn();
      await authModalPage.waitForModal();
      await authModalPage.switchToSignIn();
      await authModalPage.fillSignInForm(testUser.email, testUser.password);
      await authModalPage.clickSignIn();

      await page.waitForTimeout(2000);
    }
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
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed (without real user)
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

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
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

    // Verify user is authenticated
    expect(await authHelpers.isAuthenticated(page)).toBe(true);

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out to complete
    await userMenuPage.waitForSignInButton();

    // Verify authentication state is cleared
    const isAuthed = await authHelpers.isAuthenticated(page);
    expect(isAuthed).toBe(false);
  });

  /**
   * TC-003: Sign out clears localStorage
   */
  test('should clear auth data from localStorage', async ({ page }) => {
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

    // Get auth state before sign out
    const authBefore = await authHelpers.getAuthState(page);

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for sign out to complete
    await userMenuPage.waitForSignInButton();

    // Verify auth state is cleared
    const authAfter = await authHelpers.getAuthState(page);
    expect(authAfter).toBeNull();
  });

  /**
   * TC-004: Sign out closes user menu
   */
  test('should close user menu after sign out', async ({ page }) => {
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

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
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

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
   * TC-006: Sign out redirects to home page
   */
  test('should redirect to home page after sign out', async ({ page }) => {
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

    // Navigate to a different page
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Sign out
    await userMenuPage.openMenu();
    await userMenuPage.clickSignOut();

    // Wait for navigation
    await page.waitForTimeout(2000);

    // Verify we're on home page
    const currentUrl = page.url();
    expect(currentUrl).toContain('localhost');
    expect(currentUrl).toMatch(/\/$|\/\?/);
  });

  /**
   * TC-007: Sign out button is visible in user menu
   */
  test('should display sign out button in user menu', async ({ page }) => {
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

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
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

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
    // Sign in first
    await signInUser(page);

    // Skip if sign in failed
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

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

      // Sign in again for next iteration
      await signInUser(page);
      if (!await userMenuPage.isUserSignedIn()) {
        break; // Skip remaining if sign in failed
      }
    }
  });
});

// Test suite: User Menu UI
test.describe('User Menu - UI Elements', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;
  let userMenuPage: UserMenuPage;

  /**
   * Helper: Sign in before each test
   */
  async function signInUser(page: any) {
    await homePage.goto();
    await homePage.waitForLoaded();

    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();
    await authModalPage.fillSignInForm('test@example.com', 'TestPass123!');
    await authModalPage.clickSignIn();
    await page.waitForTimeout(2000);
  }

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);
    userMenuPage = new UserMenuPage(page);

    await signInUser(page);
  });

  /**
   * TC-010: User avatar is visible when signed in
   */
  test('should display user avatar when signed in', async ({ page }) => {
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

    await AssertHelper.assertVisible(userMenuPage.userMenuButton, 'User avatar/menu button should be visible when signed in');
  });

  /**
   * TC-011: User menu shows account email
   */
  test('should display user email in menu', async ({ page }) => {
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

    await userMenuPage.openMenu();

    const email = await userMenuPage.getUserEmail();
    expect(email).toBeTruthy();
    expect(email).toContain('@');
  });

  /**
   * TC-012: User menu has navigation links
   */
  test('should have navigation links to different pages', async ({ page }) => {
    test.skip(!await userMenuPage.isUserSignedIn(), 'Requires authenticated user');

    await userMenuPage.openMenu();

    // Check for Videos link
    expect(await userMenuPage.isMenuItemVisible('Videos')).toBe(true);

    // Check for Notes link
    expect(await userMenuPage.isMenuItemVisible('Notes')).toBe(true);

    // Check for Settings link
    expect(await userMenuPage.isMenuItemVisible('Settings')).toBe(true);
  });
});
