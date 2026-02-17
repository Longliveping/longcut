/**
 * Test Helper Functions
 * Utilities for test data, assertions, and common test operations
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Test data generator class
 */
export class TestData {
  /**
   * Generate random string
   */
  static randomString(length: number = 10): string {
    return Math.random().toString(36).substring(2, 2 + length);
  }

  /**
   * Generate random number
   */
  static randomNumber(min: number = 0, max: number = 1000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random email
   */
  static randomEmail(domain: string = 'test.com'): string {
    return `${this.randomString(8)}@${domain}`;
  }

  /**
   * Generate random password
   */
  static randomPassword(minLength: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let password = '';
    for (let i = 0; i < minLength; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Generate valid YouTube URL
   */
  static youtubeUrl(videoId?: string): string {
    const id = videoId || this.randomString(11);
    return `https://www.youtube.com/watch?v=${id}`;
  }

  /**
   * Generate valid YouTube video ID
   */
  static youtubeVideoId(): string {
    return this.randomString(11);
  }

  /**
   * Generate future date
   */
  static futureDate(days: number = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * Generate past date
   */
  static pastDate(days: number = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  /**
   * Format date for display
   */
  static formatDate(date: Date, format: 'iso' | 'readable' = 'iso'): string {
    if (format === 'iso') {
      return date.toISOString();
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

/**
 * Assertion helpers
 */
export class AssertHelper {
  /**
   * Assert element is visible
   */
  static async assertVisible(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeVisible();
  }

  /**
   * Assert element is hidden
   */
  static async assertHidden(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeHidden();
  }

  /**
   * Assert element has text
   */
  static async assertText(
    locator: Locator,
    expectedText: string | RegExp,
    message?: string
  ): Promise<void> {
    await expect(locator, message).toHaveText(expectedText);
  }

  /**
   * Assert element contains text
   */
  static async assertTextContains(
    locator: Locator,
    expectedText: string,
    message?: string
  ): Promise<void> {
    await expect(locator, message).toContainText(expectedText);
  }

  /**
   * Assert element has value
   */
  static async assertValue(
    locator: Locator,
    expectedValue: string,
    message?: string
  ): Promise<void> {
    await expect(locator, message).toHaveValue(expectedValue);
  }

  /**
   * Assert element is enabled
   */
  static async assertEnabled(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeEnabled();
  }

  /**
   * Assert element is disabled
   */
  static async assertDisabled(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeDisabled();
  }

  /**
   * Assert element is checked
   */
  static async assertChecked(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeChecked();
  }

  /**
   * Assert element count
   */
  static async assertCount(
    locator: Locator,
    expectedCount: number,
    message?: string
  ): Promise<void> {
    await expect(locator, message).toHaveCount(expectedCount);
  }

  /**
   * Assert URL contains path
   */
  static async assertUrl(page: Page, expectedUrl: string, message?: string): Promise<void> {
    await expect(page, message).toHaveURL(expectedUrl);
  }

  /**
   * Assert title
   */
  static async assertTitle(page: Page, expectedTitle: string | RegExp): Promise<void> {
    await expect(page).toHaveTitle(expectedTitle);
  }

  /**
   * Soft assertion - doesn't stop test on failure
   */
  static async softAssert(condition: boolean, message: string): Promise<boolean> {
    try {
      expect(condition, message).toBe(true);
      return true;
    } catch {
      console.warn(`Soft assertion failed: ${message}`);
      return false;
    }
  }
}

/**
 * Wait helpers
 */
export class WaitHelper {
  /**
   * Wait for condition with custom timeout
   */
  static async waitForCondition(
    condition: () => Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Wait for multiple elements to be visible
   */
  static async waitForAllVisible(locators: Locator[], timeout?: number): Promise<void> {
    await Promise.all(
      locators.map(locator => locator.waitFor({ state: 'visible', timeout }))
    );
  }

  /**
   * Wait for any element to be visible
   */
  static async waitForAnyVisible(locators: Locator[], timeout: number = 5000): Promise<Locator> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      for (const locator of locators) {
        if (await locator.isVisible().catch(() => false)) {
          return locator;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('No element became visible within timeout');
  }

  /**
   * Wait for animation to complete
   */
  static async waitForAnimation(locator: Locator): Promise<void> {
    await locator.waitForElementState('stable', { timeout: 5000 });
  }
}

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Timeout wrapper with custom error message
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return await Promise.race([
    operation,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Poll for condition with custom intervals
 */
export async function poll<T>(
  condition: () => Promise<T | null>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<T> {
  const { timeout = 10000, interval = 500, message = 'Polling timed out' } = options;
  const startTime = Date.now();
  let lastResult: T | null = null;

  while (Date.now() - startTime < timeout) {
    lastResult = await condition();
    if (lastResult !== null) {
      return lastResult;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(message);
}

/**
 * Get test configuration from environment
 */
export function getTestConfig() {
  return {
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10),
    retries: parseInt(process.env.TEST_RETRIES || '2', 10),
    headless: process.env.TEST_HEADLESS !== 'false',
    slowMo: parseInt(process.env.TEST_SLOW_MO || '0', 10),
  };
}

/**
 * Skip test based on condition
 */
export function skipTest(condition: boolean, reason: string): void {
  if (condition) {
    test.skip(true, reason);
  }
}

/**
 * Skip test in specific environment
 */
export function skipInEnvironment(environment: 'development' | 'staging' | 'production'): void {
  const currentEnv = process.env.NODE_ENV || 'development';
  skipTest(currentEnv === environment, `Test skipped in ${environment} environment`);
}

/**
 * Only run test in specific environment
 */
export function onlyInEnvironment(environment: 'development' | 'staging' | 'production'): void {
  const currentEnv = process.env.NODE_ENV || 'development';
  skipTest(currentEnv !== environment, `Test only runs in ${environment} environment`);
}

/**
 * Measure test execution time
 */
export class TestTimer {
  private startTime: number;
  private endTime?: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Stop the timer
   */
  stop(): number {
    this.endTime = Date.now();
    return this.getDuration();
  }

  /**
   * Get duration in milliseconds
   */
  getDuration(): number {
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  /**
   * Get formatted duration
   */
  getFormattedDuration(): string {
    const ms = this.getDuration();
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    return `${seconds}s ${milliseconds}ms`;
  }
}

/**
 * Test data cache for sharing data between tests
 */
export class TestCache {
  private static cache: Map<string, any> = new Map();

  static set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  static get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }

  static has(key: string): boolean {
    return this.cache.has(key);
  }

  static delete(key: string): void {
    this.cache.delete(key);
  }

  static clear(): void {
    this.cache.clear();
  }
}

/**
 * String utilities for test data
 */
export class StringHelper {
  /**
   * Generate slug from string
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Truncate string to max length
   */
  static truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Normalize whitespace
   */
  static normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Extract numbers from string
   */
  static extractNumbers(text: string): number[] {
    const matches = text.match(/\d+/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Check if string contains email
   */
  static containsEmail(text: string): boolean {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    return emailRegex.test(text);
  }

  /**
   * Mask email for display
   */
  static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (username.length <= 2) {
      return `${username[0]}*@${domain}`;
    }
    return `${username[0]}${'*'.repeat(username.length - 2)}${username[username.length - 1]}@${domain}`;
  }
}

/**
 * URL utilities for testing
 */
export class UrlHelper {
  /**
   * Parse query parameters from URL
   */
  static parseQueryParams(url: string): Record<string, string> {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  /**
   * Build URL with query parameters
   */
  static buildUrl(baseUrl: string, params: Record<string, string | number>): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  /**
   * Extract path from URL
   */
  static getPath(url: string): string {
    return new URL(url).pathname;
  }

  /**
   * Check if URLs match (ignoring query params and hash)
   */
  static pathsMatch(url1: string, url2: string): boolean {
    return this.getPath(url1) === this.getPath(url2);
  }
}
