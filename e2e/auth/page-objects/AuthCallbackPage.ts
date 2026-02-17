/**
 * AuthCallbackPage - Page Object for authentication callback handling
 * Handles OAuth redirects and email confirmation flows
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class AuthCallbackPage extends BasePage {
  // Callback elements
  readonly successIndicator: Locator;
  readonly errorIndicator: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);

    // Initialize locators
    this.successIndicator = page.locator('.text-green-500, [data-testid="auth-success"], .success-message');
    this.errorIndicator = page.locator('.text-red-500, [data-testid="auth-error"], .error-message');
    this.errorMessage = page.locator('[role="alert"], .error-message, [data-testid="error-message"]');
  }

  /**
   * Navigate to callback URL
   */
  async navigateToCallback(callbackUrl: string): Promise<void> {
    await this.navigate(callbackUrl);
    await this.waitForPageLoad();
  }

  /**
   * Wait for callback processing to complete
   */
  async waitForCallback(timeout: number = 15000): Promise<void> {
    // Wait for either success or error state, or redirect away from callback page
    await this.page.waitForLoadState('networkidle', { timeout });

    // Check if we're still on callback page or have been redirected
    const currentUrl = this.getCurrentUrl();
    if (currentUrl.includes('/auth/callback')) {
      // Still on callback page, check for success/error indicators
      const hasSuccess = await this.isVisible(this.successIndicator);
      const hasError = await this.isVisible(this.errorIndicator);

      if (!hasSuccess && !hasError) {
        // If no indicator visible yet, wait a bit more
        await this.wait(2000);
      }
    }
  }

  /**
   * Check if callback was successful
   */
  async isSuccess(): Promise<boolean> {
    // Success can be indicated by:
    // 1. Being redirected away from callback page to a successful destination
    // 2. A success indicator on the callback page
    const currentUrl = this.getCurrentUrl();

    // If we've been redirected to home or another page (not callback or error), consider it successful
    if (!currentUrl.includes('/auth/callback') && !currentUrl.includes('auth_error')) {
      return true;
    }

    // Check for success indicator on callback page
    return await this.isVisible(this.successIndicator);
  }

  /**
   * Check if callback resulted in an error
   */
  async isError(): Promise<boolean> {
    const currentUrl = this.getCurrentUrl();

    // Check URL for error parameters
    if (currentUrl.includes('auth_error') || currentUrl.includes('error=')) {
      return true;
    }

    // Check for error indicator on page
    return await this.isVisible(this.errorIndicator);
  }

  /**
   * Get error message from callback
   */
  async getErrorMessage(): Promise<string> {
    await this.waitForVisible(this.errorMessage, 5000);
    return await this.getText(this.errorMessage);
  }

  /**
   * Get error code from URL
   */
  async getErrorCode(): Promise<string | null> {
    const url = new URL(this.getCurrentUrl());
    return url.searchParams.get('error_code');
  }

  /**
   * Get error description from URL
   */
  async getErrorDescription(): Promise<string | null> {
    const url = new URL(this.getCurrentUrl());
    const description = url.searchParams.get('error_description');
    if (description) {
      return decodeURIComponent(description);
    }
    return null;
  }

  /**
   * Wait for redirect after successful callback
   */
  async waitForRedirect(expectedPath?: string, timeout: number = 15000): Promise<void> {
    if (expectedPath) {
      await this.waitForUrl(`**${expectedPath}`, timeout);
    } else {
      // Wait for redirect away from callback page
      await this.page.waitForURL(
        (url) => !url.pathname.includes('/auth/callback'),
        { timeout }
      );
    }
  }

  /**
   * Get current URL after callback
   */
  async getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Check if URL contains auth error parameter
   */
  async hasAuthErrorParam(): Promise<boolean> {
    const url = new URL(this.getCurrentUrl());
    return url.searchParams.has('auth_error');
  }

  /**
   * Get auth status from URL
   */
  async getAuthStatus(): Promise<string | null> {
    const url = new URL(this.getCurrentUrl());
    return url.searchParams.get('auth_status');
  }

  /**
   * Wait for page load state after callback
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
  }

  /**
   * Take screenshot of callback page for debugging
   */
  async captureCallbackState(): Promise<Buffer> {
    return await this.takeScreenshot('auth-callback');
  }
}
