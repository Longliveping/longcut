/**
 * Playwright Configuration
 * Main configuration file for Playwright E2E tests
 */

import { defineConfig, devices } from '@playwright/test';
import { getEnvironment } from './e2e/config/environments';

// Get the current environment configuration
const env = getEnvironment();

export default defineConfig({
  // Test directory
  testDir: './e2e/auth/tests',

  // Web server configuration - automatically start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    timeout: 120000, // 2 minutes to start
    reuseExistingServer: true, // Always reuse existing server if available
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Test file matching
  testMatch: '**/*.spec.ts',

  // Timeout per test
  timeout: env.timeout,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Run tests sequentially for auth tests (to avoid conflicts)
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: env.retries,

  // Number of workers (use 1 for auth tests to avoid conflicts)
  workers: 1,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['list'],
  ],

  // Shared settings for all tests
  use: {
    // Base URL for tests
    baseURL: env.baseUrl,

    // Collect trace when retrying the test for better debugging
    trace: env.trace,

    // Screenshot configuration
    screenshot: env.screenshot,

    // Video recording configuration
    video: env.video,

    // Headless mode
    headless: env.headless,

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,

    // Extra HTTP headers
    extraHTTPHeaders: {
      'X-Test-Environment': env.name,
    },
  },

  // Projects define different browser configurations
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Launch options for Chromium
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Mobile configurations */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results/artifacts',

  // Global setup and teardown
  // globalSetup: require.resolve('./e2e/global-setup'),
  // globalTeardown: require.resolve('./e2e/global-teardown'),
});
