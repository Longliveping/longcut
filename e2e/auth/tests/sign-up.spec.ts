/**
 * Sign Up Tests
 * Tests for email/password sign up functionality
 */

import { test, expect } from '@playwright/test';
import { HomePage } from '../page-objects/HomePage';
import { AuthModalPage } from '../page-objects/AuthModalPage';
import * as authHelpers from '../helpers/auth-helpers';
import { AssertHelper } from '../helpers/test-helpers';

// Test suite: Sign Up with Email and Password
test.describe('Sign Up - Email and Password', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);

    await homePage.goto();
    await homePage.waitForLoaded();
  });

  /**
   * TC-001: Successful sign up with valid credentials
   */
  test('should sign up successfully with valid credentials', async ({ page }) => {
    // Add request logging to debug network issues
    page.on('request', request => {
      console.log('Request:', request.method(), request.url());
    });
    page.on('response', response => {
      console.log('Response:', response.status(), response.url());
    });
    page.on('requestfailed', request => {
      console.log('Request failed:', request.url(), request.failure());
    });

    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Generate unique test user credentials
    const testUser = authHelpers.generateValidSignupData();

    // Fill in sign up form
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);

    // Submit form
    await authModalPage.clickSignUp();

    // Wait a bit to see what happens
    await page.waitForTimeout(3000);

    // Try to wait for success message (email confirmation)
    await AssertHelper.assertVisible(authModalPage.successMessage, 'Success message should appear after sign up');

    // Verify success message contains email
    const successText = await authModalPage.getSuccessMessage();
    expect(successText).toContain(testUser.email);
    expect(successText).toMatch(/created|sign in/i);
  });

  /**
   * TC-002: Failed sign up with existing email
   */
  test('should show error with existing email', async ({ page }) => {
    // First, create a user
    const testUser = authHelpers.generateValidSignupData();

    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();
    await authModalPage.waitForSuccessMessage();
    await authModalPage.closeSuccessMessage();

    // Now try to sign up with the same email
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();

    await authModalPage.fillSignUpForm(testUser.email, 'DifferentPass123!');
    await authModalPage.clickSignUp();

    // Wait for error message
    await authModalPage.waitForErrorMessage();

    // Verify error message
    const errorMessage = await authModalPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    // Error should indicate user already exists
    expect(errorMessage.toLowerCase()).toMatch(/already|exists|taken/);
  });

  /**
   * TC-003: Form validation for weak password
   */
  test('should validate password strength', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Fill valid email
    const validEmail = authHelpers.generateTestEmail();
    await authModalPage.fillInput(authModalPage.signUpEmailInput, validEmail);

    // Try weak passwords
    const weakPasswords = authHelpers.generateWeakPasswords();

    for (const weakPassword of weakPasswords.slice(0, 4)) {
      await authModalPage.fillInput(authModalPage.signUpPasswordInput, weakPassword);

      // Check if button is disabled or validation message appears
      const isDisabled = await authModalPage.isSignUpButtonDisabled();
      const passwordInput = authModalPage.signUpPasswordInput;
      const isValid = await passwordInput.evaluate(el => (el as HTMLInputElement).checkValidity());

      // At least one validation should fail
      expect(isDisabled || !isValid).toBeTruthy();
    }
  });

  /**
   * TC-004: Form validation for invalid email format
   */
  test('should validate email format', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Try invalid email formats
    const invalidEmails = authHelpers.generateInvalidEmails();

    for (const invalidEmail of invalidEmails.slice(0, 3)) {
      await authModalPage.fillInput(authModalPage.signUpEmailInput, invalidEmail);
      await authModalPage.fillInput(authModalPage.signUpPasswordInput, 'ValidPass123!');

      // Browser validation should prevent submission
      const emailInput = authModalPage.signUpEmailInput;
      const isValid = await emailInput.evaluate(el => (el as HTMLInputElement).checkValidity());
      expect(isValid).toBe(false);
    }
  });

  /**
   * TC-005: Form validation for empty fields
   */
  test('should disable sign up button with empty fields', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Check button is disabled with empty fields
    const isDisabled = await authModalPage.isSignUpButtonDisabled();
    expect(isDisabled).toBeTruthy();

    // Fill email only
    await authModalPage.fillInput(
      authModalPage.signUpEmailInput,
      'test@example.com'
    );

    // Button should still be disabled (missing password)
    const stillDisabled = await authModalPage.isSignUpButtonDisabled();
    expect(stillDisabled).toBeTruthy();
  });

  /**
   * TC-006: Minimum password length validation
   */
  test('should enforce minimum password length', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Fill valid email
    await authModalPage.fillInput(
      authModalPage.signUpEmailInput,
      authHelpers.generateTestEmail()
    );

    // Try password shorter than 6 characters
    await authModalPage.fillInput(authModalPage.signUpPasswordInput, '12345');

    // Check if validation prevents submission
    const passwordInput = authModalPage.signUpPasswordInput;
    const minLength = await passwordInput.getAttribute('minlength');
    const isValid = await passwordInput.evaluate(el => (el as HTMLInputElement).checkValidity());

    expect(minLength || !isValid).toBeTruthy();
  });

  /**
   * TC-007: Success message displays correctly
   */
  test('should display success message with email confirmation info', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Generate unique credentials
    const testUser = authHelpers.generateValidSignupData();

    // Fill and submit form
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();

    // Wait for success message
    await AssertHelper.assertVisible(authModalPage.successMessage);

    // Verify success message content
    const successText = await authModalPage.getSuccessMessage();
    expect(successText).toMatch(/account created|sign in/i);
    expect(successText).toContain(testUser.email);
  });

  /**
   * TC-008: Can close success message
   */
  test('should allow closing success message', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Generate unique credentials
    const testUser = authHelpers.generateValidSignupData();

    // Fill and submit form
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);
    await authModalPage.clickSignUp();

    // Wait for success message
    await AssertHelper.assertVisible(authModalPage.successMessage);

    // Close success message
    await authModalPage.closeSuccessMessage();

    // Verify modal is closed
    await authModalPage.waitForModalClose();
    expect(await authModalPage.isOpen()).toBe(false);
  });

  /**
   * TC-009: Sign up form has all required fields
   */
  test('should have all required input fields and labels', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Verify email field and label
    await AssertHelper.assertVisible(authModalPage.signUpEmailInput);
    const emailLabel = page.locator('label[for="signup-email"], label:has-text("Email")');
    await AssertHelper.assertVisible(emailLabel);

    // Verify password field and label
    await AssertHelper.assertVisible(authModalPage.signUpPasswordInput);
    const passwordLabel = page.locator('label[for="signup-password"], label:has-text("Password")');
    await AssertHelper.assertVisible(passwordLabel);

    // Verify sign up button
    await AssertHelper.assertVisible(authModalPage.signUpButton);
  });

  /**
   * TC-010: Sign up button shows loading state
   */
  test('should show loading state on sign up button during submission', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Fill form
    const testUser = authHelpers.generateValidSignupData();
    await authModalPage.fillSignUpForm(testUser.email, testUser.password);

    // Click sign up and check for loading state
    const promise = authModalPage.clickSignUp();
    await page.waitForTimeout(100);

    // Check for loading indicator
    const isLoading = await authModalPage.isSignUpLoading();
    expect(isLoading).toBeTruthy();

    await promise;
  });

  /**
   * TC-011: Terms of service mention
   */
  test('should mention terms of service and privacy policy', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Check for terms/policy text
    const termsText = authModalPage.modal.locator('.text-xs:has-text("Terms")');
    await AssertHelper.assertVisible(termsText);

    const text = await termsText.innerText();
    expect(text.toLowerCase()).toMatch(/terms|privacy|policy/);
  });

  /**
   * TC-012: Form clears after switching tabs
   */
  test('should clear form when switching between tabs', async ({ page }) => {
    // Open auth modal
    await homePage.clickSignIn();
    await authModalPage.waitForModal();

    // Switch to sign up tab
    await authModalPage.switchToSignUp();

    // Fill form
    await authModalPage.fillSignUpForm('test@example.com', 'TestPass123!');

    // Switch to sign in tab
    await authModalPage.switchToSignIn();

    // Switch back to sign up
    await authModalPage.switchToSignUp();

    // Verify form is cleared (or values are cleared)
    const emailValue = await authModalPage.getSignUpEmailValue();
    const passwordValue = await authModalPage.getSignUpPasswordValue();

    // Form should be cleared or values should be empty
    expect(emailValue === '' || passwordValue === '').toBeTruthy();
  });
});

// Test suite: Sign Up Modal UI
test.describe('Sign Up Modal - UI Elements', () => {
  let homePage: HomePage;
  let authModalPage: AuthModalPage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    authModalPage = new AuthModalPage(page);

    await homePage.goto();
    await homePage.clickSignIn();
    await authModalPage.waitForModal();
    await authModalPage.switchToSignUp();
  });

  /**
   * TC-013: Sign up tab is active
   */
  test('should have sign up tab active', async ({ page }) => {
    expect(await authModalPage.isSignUpTabActive()).toBe(true);
  });

  /**
   * TC-014: Create Account button text
   */
  test('should display Create Account button text', async ({ page }) => {
    const buttonText = await authModalPage.signUpButton.innerText();
    expect(buttonText).toContain('Create Account');
  });

  /**
   * TC-015: Password placeholder mentions minimum length
   */
  test('should show password placeholder with minimum length hint', async ({ page }) => {
    const placeholder = await authModalPage.signUpPasswordInput.getAttribute('placeholder');
    expect(placeholder).toMatch(/6|character/i);
  });
});
