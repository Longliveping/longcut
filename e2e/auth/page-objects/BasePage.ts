/**
 * BasePage - Foundation class for all page objects
 * Provides common functionality and utilities for E2E testing
 */

import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly baseUrl: string;

  constructor(page: Page, baseUrl: string = process.env.TEST_BASE_URL || 'http://localhost:3000') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  /**
   * Navigate to a specific path on the site
   */
  async navigate(path: string = ''): Promise<void> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Wait for the page to be fully loaded
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Take a screenshot with automatic filename generation
   */
  async takeScreenshot(name: string): Promise<Buffer> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `test-results/screenshots/${name}-${timestamp}.png`;
    return await this.page.screenshot({ path, fullPage: true });
  }

  /**
   * Click an element with retry logic
   */
  async clickWithRetry(locator: Locator, maxRetries: number = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await expect(locator, { timeout: 5000 }).toBeVisible();
        await locator.click();
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.page.waitForTimeout(500);
      }
    }
  }

  /**
   * Fill an input field with clear and type
   */
  async fillInput(locator: Locator, value: string): Promise<void> {
    await expect(locator, { timeout: 5000 }).toBeVisible();
    await locator.clear();
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }

  /**
   * Wait for an element to be visible
   */
  async waitForVisible(locator: Locator, timeout: number = 10000): Promise<void> {
    await expect(locator, { timeout }).toBeVisible();
  }

  /**
   * Wait for an element to be hidden
   */
  async waitForHidden(locator: Locator, timeout: number = 10000): Promise<void> {
    await expect(locator, { timeout }).toBeHidden();
  }

  /**
   * Wait for an element to be attached to DOM
   */
  async waitForAttached(locator: Locator, timeout: number = 10000): Promise<void> {
    await expect(locator, { timeout }).toBeAttached();
  }

  /**
   * Get text content from an element
   */
  async getText(locator: Locator): Promise<string> {
    await this.waitForVisible(locator);
    return await locator.innerText();
  }

  /**
   * Check if an element is visible
   */
  async isVisible(locator: Locator): Promise<boolean> {
    try {
      await expect(locator, { timeout: 2000 }).toBeVisible();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if an element is hidden
   */
  async isHidden(locator: Locator): Promise<boolean> {
    try {
      await expect(locator, { timeout: 2000 }).toBeHidden();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for URL to contain specific string
   */
  async waitForUrl(url: string, timeout: number = 15000): Promise<void> {
    await this.page.waitForURL(url, { timeout });
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Reload the page
   */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
  }

  /**
   * Execute JavaScript in the browser context
   */
  async evaluate<T>(script: string | ((arg: any) => T), arg?: any): Promise<T> {
    return await this.page.evaluate(script, arg);
  }

  /**
   * Get all localStorage data
   */
  async getLocalStorage(): Promise<Record<string, string>> {
    return await this.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          data[key] = localStorage.getItem(key) || '';
        }
      }
      return data;
    });
  }

  /**
   * Set localStorage item
   */
  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.evaluate((args: [string, string]) => {
      localStorage.setItem(args[0], args[1]);
    }, [key, value]);
  }

  /**
   * Remove localStorage item
   */
  async removeLocalStorageItem(key: string): Promise<void> {
    await this.evaluate((key: string) => {
      localStorage.removeItem(key);
    }, key);
  }

  /**
   * Clear all localStorage
   */
  async clearLocalStorage(): Promise<void> {
    await this.evaluate(() => {
      localStorage.clear();
    });
  }

  /**
   * Get all sessionStorage data
   */
  async getSessionStorage(): Promise<Record<string, string>> {
    return await this.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          data[key] = sessionStorage.getItem(key) || '';
        }
      }
      return data;
    });
  }

  /**
   * Set sessionStorage item
   */
  async setSessionStorageItem(key: string, value: string): Promise<void> {
    await this.evaluate((args: [string, string]) => {
      sessionStorage.setItem(args[0], args[1]);
    }, [key, value]);
  }

  /**
   * Wait for a specific timeout (use sparingly, prefer waiting for elements)
   */
  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Handle any visible toast/alert messages
   */
  async getToastMessages(): Promise<string[]> {
    const toasts = this.page.locator('[data-sonner-toast]');
    const count = await toasts.count();
    const messages: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await toasts.nth(i).innerText();
      messages.push(text);
    }

    return messages;
  }

  /**
   * Wait for toast message to appear
   */
  async waitForToast(message: string, timeout: number = 5000): Promise<void> {
    await this.page.waitForSelector(`[data-sonner-toast]:has-text("${message}")`, { timeout });
  }
}
