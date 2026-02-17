/**
 * HomePage - Page Object for the home page (/)
 * Handles interactions with the main landing page
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  // Page elements
  readonly title: Locator;
  readonly description: Locator;
  readonly urlInput: Locator;
  readonly submitButton: Locator;
  readonly feelingLuckyButton: Locator;
  readonly modeSelector: Locator;
  readonly signInButton: Locator;

  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);

    // Initialize locators
    this.title = page.getByText('LongCut');
    this.description = page.getByText('The best way to learn from long videos.');
    this.urlInput = page.locator('input[type="text"], input[placeholder*="YouTube"], input[placeholder*="URL"]');
    this.submitButton = page.locator('button[type="submit"], button:has-text("Analyze"), button:has-text("Go")');
    this.feelingLuckyButton = page.locator('button:has-text("Feeling Lucky")');
    this.modeSelector = page.locator('[data-testid="mode-selector"], .mode-selector');
    this.signInButton = page.locator('button:has-text("Sign In")');
  }

  /**
   * Navigate to the home page
   */
  async goto(): Promise<void> {
    await this.navigate('/');
    await this.waitForPageLoad();
  }

  /**
   * Wait for home page to be fully loaded
   */
  async waitForLoaded(): Promise<void> {
    await this.waitForVisible(this.title);
    await this.waitForVisible(this.description);
    await this.waitForVisible(this.urlInput);
  }

  /**
   * Check if we're on the home page
   */
  async isOnHomePage(): Promise<boolean> {
    const currentUrl = this.getCurrentUrl();
    return currentUrl === `${this.baseUrl}/` || currentUrl === this.baseUrl;
  }

  /**
   * Get the home page title text
   */
  async getPageTitle(): Promise<string> {
    await this.waitForVisible(this.title);
    return await this.getText(this.title);
  }

  /**
   * Get the description text
   */
  async getDescription(): Promise<string> {
    await this.waitForVisible(this.description);
    return await this.getText(this.description);
  }

  /**
   * Fill in the URL input field
   */
  async fillUrlInput(url: string): Promise<void> {
    await this.fillInput(this.urlInput, url);
  }

  /**
   * Submit the URL form
   */
  async submitUrl(): Promise<void> {
    await this.clickWithRetry(this.submitButton);
  }

  /**
   * Enter a YouTube URL and submit
   */
  async analyzeVideo(url: string): Promise<void> {
    await this.fillUrlInput(url);
    await this.submitUrl();
  }

  /**
   * Click the "Feeling Lucky" button
   */
  async clickFeelingLucky(): Promise<void> {
    await this.clickWithRetry(this.feelingLuckyButton);
  }

  /**
   * Check if Sign In button is visible
   */
  async isSignInButtonVisible(): Promise<boolean> {
    return await this.isVisible(this.signInButton);
  }

  /**
   * Click Sign In button
   */
  async clickSignIn(): Promise<void> {
    await this.clickWithRetry(this.signInButton);
  }

  /**
   * Get current mode preference (smart/fast)
   */
  async getCurrentMode(): Promise<'smart' | 'fast'> {
    const modeButton = this.page.locator('[data-testid="mode-selector"] button:has-text("Smart")');
    const isSelected = await modeButton.getAttribute('data-state');
    return isSelected === 'checked' ? 'smart' : 'fast';
  }

  /**
   * Set mode preference
   */
  async setMode(mode: 'smart' | 'fast'): Promise<void> {
    const modeButton = this.page.locator(
      `[data-testid="mode-selector"] button:has-text("${mode === 'smart' ? 'Smart' : 'Fast'}")`
    );
    await this.clickWithRetry(modeButton);
  }

  /**
   * Check if URL input is empty
   */
  async isUrlInputEmpty(): Promise<boolean> {
    const value = await this.urlInput.inputValue();
    return value === '';
  }

  /**
   * Get URL input value
   */
  async getUrlInputValue(): Promise<string> {
    return await this.urlInput.inputValue();
  }

  /**
   * Wait for navigation to analysis page
   */
  async waitForAnalysisNavigation(videoId: string): Promise<void> {
    await this.waitForUrl(`**/analyze/${videoId}**`, 15000);
  }

  /**
   * Check if auth modal is open
   */
  async isAuthModalOpen(): Promise<boolean> {
    const modal = this.page.locator('[role="dialog"]:has-text("Sign in to LongCut")');
    return await this.isVisible(modal);
  }

  /**
   * Get auth modal title
   */
  async getAuthModalTitle(): Promise<string> {
    const modalTitle = this.page.locator('[role="dialog"] h2, [role="dialog"] [data-dialog-title]');
    await this.waitForVisible(modalTitle);
    return await this.getText(modalTitle);
  }
}
