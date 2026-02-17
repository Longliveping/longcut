/**
 * Browser Helper Functions
 * Utilities for browser operations, screenshots, and debugging
 */

import { Page, BrowserContext, Locator } from '@playwright/test';

export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
  mask?: Locator[];
}

/**
 * Take a screenshot with automatic naming
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options: ScreenshotOptions = {}
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultPath = `test-results/screenshots/${name}-${timestamp}.png`;

  const screenshotOptions = {
    path: options.path || defaultPath,
    fullPage: options.fullPage !== false, // Default to full page
    mask: options.mask || [],
  };

  return await page.screenshot(screenshotOptions);
}

/**
 * Take a screenshot on test failure
 */
export async function takeScreenshotOnFailure(
  page: Page,
  testName: string
): Promise<Buffer> {
  return await takeScreenshot(page, `failure-${testName}`, {
    fullPage: true,
  });
}

/**
 * Capture console logs for debugging
 */
export async function captureConsoleLogs(
  page: Page,
  testContext?: string
): Promise<any[]> {
  const logs: any[] = [];

  page.on('console', (msg) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      context: testContext,
    });
  });

  return logs;
}

/**
 * Get all console logs from page
 */
export async function getConsoleLogs(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    return (window as any).__consoleLogs || [];
  });
}

/**
 * Clear browser data (cookies, storage, cache)
 */
export async function clearBrowserData(context: BrowserContext): Promise<void> {
  await context.clearCookies();
  await context.clearPermissions();

  // Clear all pages' localStorage and sessionStorage
  const pages = context.pages();
  for (const page of pages) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

/**
 * Clear specific cookies
 */
export async function clearCookiesByName(
  context: BrowserContext,
  cookieNames: string[]
): Promise<void> {
  const cookies = await context.cookies();
  const cookiesToClear = cookies.filter(cookie =>
    cookieNames.includes(cookie.name)
  );

  await context.clearCookies(cookiesToClear);
}

/**
 * Get all cookies from context
 */
export async function getAllCookies(context: BrowserContext): Promise<any[]> {
  return await context.cookies();
}

/**
 * Get specific cookie value
 */
export async function getCookie(
  context: BrowserContext,
  name: string
): Promise<string | undefined> {
  const cookies = await context.cookies();
  const cookie = cookies.find(c => c.name === name);
  return cookie?.value;
}

/**
 * Set a cookie
 */
export async function setCookie(
  context: BrowserContext,
  name: string,
  value: string,
  options: {
    url?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {}
): Promise<void> {
  await context.addCookies([
    {
      name,
      value,
      ...options,
    },
  ]);
}

/**
 * Wait for network idle (no network requests for specified duration)
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for specific network response
 */
export async function waitForResponse(
  page: Page,
  urlOrPredicate: string | ((response: any) => boolean),
  timeout: number = 30000
): Promise<any> {
  const response = await page.waitForResponse(
    typeof urlOrPredicate === 'string'
      ? (res) => res.url().includes(urlOrPredicate)
      : urlOrPredicate,
    { timeout }
  );
  return response;
}

/**
 * Block specific network requests (e.g., analytics)
 */
export async function blockRequests(page: Page, patterns: string[]): Promise<void> {
  await page.route(patterns, (route) => route.abort());
}

/**
 * Mock API responses
 */
export async function mockAPIResponse(
  page: Page,
  urlPattern: string,
  mockResponse: any,
  status: number = 200
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    });
  });
}

/**
 * Intercept and modify API requests
 */
export async function interceptAPIRequest(
  page: Page,
  urlPattern: string,
  modifier: (request: any) => void
): Promise<void> {
  await page.route(urlPattern, async (route) => {
    const request = route.request();
    modifier(request);
    await route.continue();
  });
}

/**
 * Get page performance metrics
 */
export async function getPerformanceMetrics(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as any;
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
    };
  });
}

/**
 * Set viewport size
 */
export async function setViewport(
  page: Page,
  width: number,
  height: number
): Promise<void> {
  await page.setViewportSize({ width, height });
}

/**
 * Set geolocation
 */
export async function setGeolocation(
  context: BrowserContext,
  latitude: number,
  longitude: number
): Promise<void> {
  await context.setGeolocation({ latitude, longitude });
}

/**
 * Set timezone for the browser context
 */
export async function setTimezone(context: BrowserContext, timezone: string): Promise<void> {
  await context.setGeolocation({ timezone });
}

/**
 * Get browser user agent
 */
export async function getUserAgent(page: Page): Promise<string> {
  return await page.evaluate(() => navigator.userAgent);
}

/**
 * Set locale
 */
export async function setLocale(context: BrowserContext, locale: string): Promise<void> {
  await context.setExtraHTTPHeaders({
    'Accept-Language': locale,
  });
}

/**
 * Emulate device
 */
export async function emulateDevice(
  page: Page,
  device: {
    viewport: { width: number; height: number };
    userAgent: string;
    deviceScaleFactor?: number;
  }
): Promise<void> {
  await page.setViewportSize(device.viewport);
  await page.setExtraHTTPHeaders({
    'User-Agent': device.userAgent,
  });
}

/**
 * Emulate mobile device
 */
export async function emulateMobile(page: Page): Promise<void> {
  await emulateDevice(page, {
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    deviceScaleFactor: 2,
  });
}

/**
 * Emulate desktop
 */
export async function emulateDesktop(page: Page): Promise<void> {
  await emulateDevice(page, {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    deviceScaleFactor: 1,
  });
}

/**
 * Hover over element
 */
export async function hover(page: Page, selector: string): Promise<void> {
  await page.hover(selector);
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string): Promise<void> {
  await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Scroll to top of page
 */
export async function scrollToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
}

/**
 * Scroll to bottom of page
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
}

/**
 * Get scroll position
 */
export async function getScrollPosition(page: Page): Promise<{ x: number; y: number }> {
  return await page.evaluate(() => ({
    x: window.scrollX || window.pageXOffset,
    y: window.scrollY || window.pageYOffset,
  }));
}

/**
 * Reload page with bypassing cache
 */
export async function reloadBypassingCache(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'networkidle' });
}

/**
 * Go back in browser history
 */
export async function goBack(page: Page): Promise<void> {
  await page.goBack({ waitUntil: 'networkidle' });
}

/**
 * Go forward in browser history
 */
export async function goForward(page: Page): Promise<void> {
  await page.goForward({ waitUntil: 'networkidle' });
}

/**
 * Press keyboard key
 */
export async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

/**
 * Type text with delay
 */
export async function typeWithDelay(
  page: Page,
  selector: string,
  text: string,
  delay: number = 50
): Promise<void> {
  await page.type(selector, text, { delay });
}

/**
 * Upload file
 */
export async function uploadFile(page: Page, selector: string, filePath: string): Promise<void> {
  const fileInput = page.locator(selector);
  await fileInput.setInputFiles(filePath);
}

/**
 * Download file
 */
export async function downloadFile(page: Page, selector: string): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click(selector),
  ]);

  return await download.createReadStream();
}

/**
 * Get page title
 */
export async function getPageTitle(page: Page): Promise<string> {
  return await page.title();
}

/**
 * Get page HTML
 */
export async function getPageHTML(page: Page): Promise<string> {
  return await page.content();
}

/**
 * Execute JavaScript in browser context
 */
export async function executeScript<T>(
  page: Page,
  script: string | ((arg: any) => T),
  arg?: any
): Promise<T> {
  return await page.evaluate(script, arg);
}

/**
 * Add init script to page
 */
export async function addInitScript(page: Page, script: string): Promise<void> {
  await page.addInitScript(script);
}

/**
 * Expose function to page context
 */
export async function exposeFunction(
  page: Page,
  name: string,
  func: Function
): Promise<void> {
  await page.exposeFunction(name, func);
}

/**
 * Wait for element to be stable (not moving)
 */
export async function waitForStable(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<void> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });

  const box1 = await element.boundingBox();
  await page.waitForTimeout(100);
  const box2 = await element.boundingBox();

  if (box1 && box2 && (
    box1.x !== box2.x ||
    box1.y !== box2.y ||
    box1.width !== box2.width ||
    box1.height !== box2.height
  )) {
    await page.waitForTimeout(200);
  }
}

/**
 * Get element bounding box
 */
export async function getBoundingBox(
  page: Page,
  selector: string
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return await page.locator(selector).boundingBox();
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).isInViewport();
}

/**
 * Get element text content
 */
export async function getTextContent(page: Page, selector: string): Promise<string> {
  return await page.locator(selector).innerText();
}

/**
 * Get element attribute
 */
export async function getAttribute(
  page: Page,
  selector: string,
  attribute: string
): Promise<string | null> {
  return await page.locator(selector).getAttribute(attribute);
}

/**
 * Set element attribute
 */
export async function setAttribute(
  page: Page,
  selector: string,
  attribute: string,
  value: string
): Promise<void> {
  await page.locator(selector).evaluate(
    (el: any, attr: string, val: string) => el.setAttribute(attr, val),
    attribute,
    value
  );
}

/**
 * Remove element attribute
 */
export async function removeAttribute(
  page: Page,
  selector: string,
  attribute: string
): Promise<void> {
  await page.locator(selector).evaluate(
    (el: any, attr: string) => el.removeAttribute(attr),
    attribute
  );
}
