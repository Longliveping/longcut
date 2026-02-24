/**
 * Sign In Tests
 * Tests for email/password sign in functionality
 * Note: With Lucia auth, we must create users via sign-up before testing sign-in
 */

import { test, expect } from '@playwright/test';
import { HomePage } from '../page-objects/HomePage';
import { AuthModalPage } from '../page-objects/AuthModalPage';
import { UserMenuPage } from '../page-objects/UserMenuPage';
import * as authHelpers from '../helpers/auth-helpers';
import { AssertHelper } from '../helpers/test-helpers';

// Test suite: Sign In with Email and Password
test.describe('Sign In - Email and Password', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;
  let userMenuPage: UserMenuPage;

  // Setup before each test
  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);
    userMenuPage = new UserMenuPage(page);

    await homePage.goto();
    await homePage.waitForLoaded();
  });

  /**
   * TC-001: Successful sign in with valid credentials
   * Note: Must first create user via sign-up, then sign in
   */
  test('should sign in successfully with valid credentials', async ({ page }) => {
    const testUser = authHelpers.generateValidSignupData();

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

    // Wait for page reload after successful sign-in
    await page.waitForLoadState('networkidle');

    // Verify user is signed in (user menu button should be visible)
    await userMenuPage.waitForUserMenu();
    const isSignedIn = await userMenuPage.isUserSignedIn();
    expect(isSignedIn).toBe(true);
  });

  /**
   * TC-002: Failed sign in with invalid credentials
   */
  test('should show error with invalid credentials', async ({ page }) => {
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();

    // Fill in invalid credentials (random email that doesn't exist)
    await authModalPage.fillSignInForm(
      authHelpers.generateTestEmail(),
      authHelpers.generateTestPassword()
    );

    await authModalPage.clickSignIn();

    // Wait for error message
    await authModalPage.waitForErrorMessage();

    // Verify error message is displayed
    const errorMessage = await authModalPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.length).toBeGreaterThan(0);

    // Verify modal stays open
    await AssertHelper.assertVisible(authModalPage.modal, 'Modal should remain open on failed sign in');
  });

  /**
   * TC-003: Failed sign in with wrong password
   * First create a user, then try to sign in with wrong password
   */
  test('should show error with correct email but wrong password', async ({ page }) => {
    const testUser = authHelpers.generateValidSignupData();
    const wrongPassword = 'WrongPassword123!';

    // Create user first
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();
    await authModalPage.waitForSuccessMessage();
    await authModalPage.closeSuccessMessage();

    // Try to sign in with wrong password
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();
    await authModalPage.fillSignInForm(testUser.email, wrongPassword);
    await authModalPage.clickSignIn();

    // Wait for error message
    await authModalPage.waitForErrorMessage();

    // Verify error message
    const errorMessage = await authModalPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
  });

  /**
   * TC-004: Failed sign in with non-existent email
   */
  test('should show error with non-existent email', async ({ page }) => {
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();

    await authModalPage.fillSignInForm(
      'nonexistent@example.com',
      'SomePassword123!'
    );

    await authModalPage.clickSignIn();
    await authModalPage.waitForErrorMessage();

    const errorMessage = await authModalPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
  });

  /**
   * TC-005: Form validation for empty fields
   */
  test('should disable sign in button with empty fields', async ({ page }) => {
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();

    // Check button is disabled with empty fields
    const isDisabled = await authModalPage.isSignInButtonDisabled();
    expect(isDisabled).toBeTruthy();

    // Fill email only
    await authModalPage.fillInput(
      authModalPage.signInEmailInput,
      'test@example.com'
    );

    // Check button is still disabled (missing password)
    const stillDisabled = await authModalPage.isSignInButtonDisabled();
    expect(stillDisabled).toBeTruthy();
  });

  /**
   * TC-006: Form validation for invalid email format
   */
  test('should validate email format', async ({ page }) => {
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignIn();

    const invalidEmails = authHelpers.generateInvalidEmails();

    for (const invalidEmail of invalidEmails.slice(0, 3)) {
      await authModalPage.fillInput(authModalPage.signInEmailInput, invalidEmail);
      await authModalPage.fillInput(authModalPage.signInPasswordInput, 'Password123!');

      const emailInput = authModalPage.signInEmailInput;
      const isValid = await emailInput.evaluate(el => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }
  });

  /**
   * TC-007: Sign in modal opens and closes correctly
   */
  test('should open and close sign in modal', async ({ page }) => {
    expect(await authModalPage.isOpen()).toBe(false);

    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    expect(await authModalPage.isOpen()).toBe(true);

    await authModalPage.closeByEscape();
    await authModalPage.waitForModalClose();
    expect(await authModalPage.isOpen()).toBe(false);
  });

  /**
   * TC-008: Sign in shows user menu after success
   */
  test('should reload page and show user menu after sign in', async ({ page }) => {
    const testUser = authHelpers.generateValidSignupData();

    // Create user first
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

    // Wait for page reload after successful sign-in
    await page.waitForLoadState('networkidle');

    // User menu should be visible
    await userMenuPage.waitForUserMenu();
    expect(await userMenuPage.isUserSignedIn()).toBe(true);

    // Verify we're still on home page
    const currentUrl = page.url();
    expect(currentUrl).toContain('localhost');
  });
});

// Test suite: Sign In Modal UI
test.describe('Sign In Modal - UI Elements', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);

    await homePage.goto();
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
  });

  /**
   * TC-009: Modal has correct title and description
   */
  test('should display correct title and description', async ({ page }) => {
    const title = await authModalPage.getTitle();
    expect(title).toContain('Sign in');

    const description = await authModalPage.getDescription();
    expect(description).toBeTruthy();
    expect(description.length).toBeGreaterThan(0);
  });

  /**
   * TC-010: Modal has all required input fields
   */
  test('should have email and password input fields', async ({ page }) => {
    await AssertHelper.assertVisible(authModalPage.signInEmailInput);
    await AssertHelper.assertVisible(authModalPage.signInPasswordInput);
  });

  /**
   * TC-011: Modal has sign in button
   */
  test('should have sign in button', async ({ page }) => {
    await AssertHelper.assertVisible(authModalPage.signInButton);
    const buttonText = await authModalPage.signInButton.innerText();
    expect(buttonText).toContain('Sign In');
  });

  /**
   * TC-012: Tabs switch correctly between sign in and sign up
   */
  test('should switch tabs correctly', async ({ page }) => {
    expect(await authModalPage.isSignInTabActive()).toBe(true);

    await authModalPage.switchToSignUp();
    expect(await authModalPage.isSignUpTabActive()).toBe(true);

    await authModalPage.switchToSignIn();
    expect(await authModalPage.isSignInTabActive()).toBe(true);
  });
});

// Test suite: Sign In Integration
test.describe('Sign In - Integration', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;
  let userMenuPage: UserMenuPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);
    userMenuPage = new UserMenuPage(page);
  });

  /**
   * TC-013: User can sign out after signing in
   */
  test('should allow sign out after successful sign in', async ({ page }) => {
    const testUser = authHelpers.generateValidSignupData();

    await homePage.goto();
    await homePage.waitForLoaded();

    // Create user
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

    // Verify signed in, then sign out
    if (await userMenuPage.isUserSignedIn()) {
      await userMenuPage.openMenu();
      await userMenuPage.clickSignOut();

      // Verify signed out state
      await userMenuPage.waitForSignInButton();
      expect(await userMenuPage.isSignInButtonVisible()).toBe(true);
    }
  });
});
