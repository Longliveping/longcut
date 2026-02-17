/**
 * AuthModalPage - Page Object for the authentication modal
 * Handles sign in, sign up, and OAuth interactions
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export type AuthModalTrigger = 'generation-limit' | 'save-video' | 'manual' | 'save-note';

export class AuthModalPage extends BasePage {
  // Modal container
  readonly modal: Locator;

  // Tabs
  readonly signInTab: Locator;
  readonly signUpTab: Locator;

  // Sign In form elements
  readonly signInEmailInput: Locator;
  readonly signInPasswordInput: Locator;
  readonly signInButton: Locator;
  readonly googleSignInButton: Locator;

  // Sign Up form elements
  readonly signUpEmailInput: Locator;
  readonly signUpPasswordInput: Locator;
  readonly signUpButton: Locator;
  readonly googleSignUpButton: Locator;

  // Success state
  readonly successMessage: Locator;
  readonly successCloseButton: Locator;

  // Error state
  readonly errorMessage: Locator;

  // Benefits card
  readonly benefitsCard: Locator;

  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);

    // Initialize locators
    this.modal = page.locator('[role="dialog"]');
    this.signInTab = page.locator('button:has-text("Sign In")');
    this.signUpTab = page.locator('button:has-text("Sign Up")');

    // Sign In elements
    this.signInEmailInput = page.locator('input#signin-email, input[type="email"]:visible');
    this.signInPasswordInput = page.locator('input#signin-password, input[type="password"]:visible');
    this.signInButton = page.locator('button:has-text("Sign In")');
    this.googleSignInButton = page.locator('button:has-text("Continue with Google")');

    // Sign Up elements
    this.signUpEmailInput = page.locator('input#signup-email');
    this.signUpPasswordInput = page.locator('input#signup-password');
    this.signUpButton = page.locator('button:has-text("Create Account")');
    this.googleSignUpButton = page.locator('button:has-text("Continue with Google")');

    // Success state
    this.successMessage = page.locator('[role="dialog"]:has-text("Check your email")');
    this.successCloseButton = page.locator('[role="dialog"] button:has-text("Got it")');

    // Error state
    this.errorMessage = page.locator('[role="alert"], [data-testid="error-message"]');

    // Benefits card
    this.benefitsCard = page.locator('.bg-muted\\/50, [data-testid="benefits-card"]');
  }

  /**
   * Wait for modal to be visible
   */
  async waitForModal(): Promise<void> {
    await this.waitForVisible(this.modal);
  }

  /**
   * Check if modal is open
   */
  async isOpen(): Promise<boolean> {
    return await this.isVisible(this.modal);
  }

  /**
   * Get modal title
   */
  async getTitle(): Promise<string> {
    const title = this.modal.locator('h2, [data-dialog-title]');
    await this.waitForVisible(title);
    return await this.getText(title);
  }

  /**
   * Get modal description
   */
  async getDescription(): Promise<string> {
    const description = this.modal.locator('p, [data-dialog-description]');
    await this.waitForVisible(description.first);
    return await this.getText(description.first);
  }

  /**
   * Switch to Sign In tab
   */
  async switchToSignIn(): Promise<void> {
    await this.clickWithRetry(this.signInTab);
    await this.waitForVisible(this.signInEmailInput);
  }

  /**
   * Switch to Sign Up tab
   */
  async switchToSignUp(): Promise<void> {
    await this.clickWithRetry(this.signUpTab);
    await this.waitForVisible(this.signUpEmailInput);
  }

  /**
   * Check if Sign In tab is active
   */
  async isSignInTabActive(): Promise<boolean> {
    const state = await this.signInTab.getAttribute('data-state');
    return state === 'active' || state === 'checked';
  }

  /**
   * Check if Sign Up tab is active
   */
  async isSignUpTabActive(): Promise<boolean> {
    const state = await this.signUpTab.getAttribute('data-state');
    return state === 'active' || state === 'checked';
  }

  /**
   * Fill in sign in form
   */
  async fillSignInForm(email: string, password: string): Promise<void> {
    await this.fillInput(this.signInEmailInput, email);
    await this.fillInput(this.signInPasswordInput, password);
  }

  /**
   * Fill in sign up form
   */
  async fillSignUpForm(email: string, password: string): Promise<void> {
    await this.fillInput(this.signUpEmailInput, email);
    await this.fillInput(this.signUpPasswordInput, password);
  }

  /**
   * Click Sign In button
   */
  async clickSignIn(): Promise<void> {
    await this.clickWithRetry(this.signInButton);
  }

  /**
   * Click Sign Up button
   */
  async clickSignUp(): Promise<void> {
    await this.clickWithRetry(this.signUpButton);
  }

  /**
   * Complete sign in flow
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.switchToSignIn();
    await this.fillSignInForm(email, password);
    await this.clickSignIn();
  }

  /**
   * Complete sign up flow
   */
  async signUp(email: string, password: string): Promise<void> {
    await this.switchToSignUp();
    await this.fillSignUpForm(email, password);
    await this.clickSignUp();
  }

  /**
   * Click Google Sign In button
   */
  async clickGoogleSignIn(): Promise<void> {
    await this.clickWithRetry(this.googleSignInButton);
  }

  /**
   * Click Google Sign Up button
   */
  async clickGoogleSignUp(): Promise<void> {
    await this.clickWithRetry(this.googleSignUpButton);
  }

  /**
   * Check if success message is visible
   */
  async isSuccessMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.successMessage);
  }

  /**
   * Get success message text
   */
  async getSuccessMessage(): Promise<string> {
    await this.waitForVisible(this.successMessage);
    const message = this.successMessage.locator('p, div');
    return await this.getText(message.first);
  }

  /**
   * Close success message
   */
  async closeSuccessMessage(): Promise<void> {
    await this.clickWithRetry(this.successCloseButton);
  }

  /**
   * Check if error message is visible
   */
  async isErrorMessageVisible(): Promise<boolean> {
    return await this.isVisible(this.errorMessage);
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    await this.waitForVisible(this.errorMessage);
    return await this.getText(this.errorMessage);
  }

  /**
   * Wait for error message to appear
   */
  async waitForErrorMessage(): Promise<void> {
    await this.waitForVisible(this.errorMessage);
  }

  /**
   * Check if benefits card is visible
   */
  async isBenefitsCardVisible(): Promise<boolean> {
    return await this.isVisible(this.benefitsCard);
  }

  /**
   * Get benefits list
   */
  async getBenefits(): Promise<string[]> {
    const benefits = this.benefitsCard.locator('li');
    const count = await benefits.count();
    const benefitTexts: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await benefits.nth(i).innerText();
      benefitTexts.push(text.trim());
    }

    return benefitTexts;
  }

  /**
   * Check if sign in button is disabled
   */
  async isSignInButtonDisabled(): Promise<boolean> {
    const disabled = await this.signInButton.getAttribute('disabled');
    return disabled !== null;
  }

  /**
   * Check if sign up button is disabled
   */
  async isSignUpButtonDisabled(): Promise<boolean> {
    const disabled = await this.signUpButton.getAttribute('disabled');
    return disabled !== null;
  }

  /**
   * Get loading state of button
   */
  async isSignInLoading(): Promise<boolean> {
    const loader = this.signInButton.locator('svg.animate-spin');
    return await this.isVisible(loader);
  }

  /**
   * Get loading state of sign up button
   */
  async isSignUpLoading(): Promise<boolean> {
    const loader = this.signUpButton.locator('svg.animate-spin');
    return await this.isVisible(loader);
  }

  /**
   * Check if in-app browser warning is visible
   */
  async isInAppBrowserWarningVisible(): Promise<boolean> {
    const warning = this.modal.locator('.bg-amber-50, .bg-yellow-50');
    return await this.isVisible(warning);
  }

  /**
   * Get in-app browser warning text
   */
  async getInAppBrowserWarning(): Promise<string> {
    const warning = this.modal.locator('.bg-amber-50, .bg-yellow-50');
    await this.waitForVisible(warning);
    return await this.getText(warning);
  }

  /**
   * Wait for modal to close
   */
  async waitForModalClose(): Promise<void> {
    await this.waitForHidden(this.modal);
  }

  /**
   * Close modal by clicking outside (if supported)
   */
  async closeByClickingOutside(): Promise<void> {
    await this.page.mouse.click(0, 0);
    await this.waitForModalClose();
  }

  /**
   * Press Escape key to close modal
   */
  async closeByEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.waitForModalClose();
  }

  /**
   * Check if "or continue with email" separator is visible
   */
  async isEmailSeparatorVisible(): Promise<boolean> {
    const separator = this.modal.locator('.relative:has(span:has-text("or continue with email"))');
    return await this.isVisible(separator);
  }

  /**
   * Get email input value in sign in form
   */
  async getSignInEmailValue(): Promise<string> {
    return await this.signInEmailInput.inputValue();
  }

  /**
   * Get password input value in sign in form
   */
  async getSignInPasswordValue(): Promise<string> {
    return await this.signInPasswordInput.inputValue();
  }

  /**
   * Get email input value in sign up form
   */
  async getSignUpEmailValue(): Promise<string> {
    return await this.signUpEmailInput.inputValue();
  }

  /**
   * Get password input value in sign up form
   */
  async getSignUpPasswordValue(): Promise<string> {
    return await this.signUpPasswordInput.inputValue();
  }
}
