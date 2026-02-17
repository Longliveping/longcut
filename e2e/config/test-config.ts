/**
 * Test Configuration
 * Centralized configuration for E2E tests
 */

import { defineConfig, devices, PlaywrightTestConfig } from '@playwright/test';
import path from 'path';

/**
 * Base test configuration
 */
export const baseConfig: PlaywrightTestConfig = {
  testDir: './e2e/auth/tests',
  testMatch: '**/*.spec.ts',
  timeout: 30 * 1000, // 30 seconds
  expect: {
    timeout: 5 * 1000, // 5 seconds
  },
  fullyParallel: false, // Auth tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run tests sequentially for auth
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/junit-results.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  outputDir: 'test-results/artifacts',
};

/**
 * Development configuration
 */
export const devConfig: Partial<PlaywrightTestConfig> = {
  baseURL: 'http://localhost:3000',
  headless: false,
  retries: 0,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
};

/**
 * CI configuration
 */
export const ciConfig: Partial<PlaywrightTestConfig> = {
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
  headless: true,
  retries: 2,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
};

/**
 * Test-specific configurations
 */
export const testConfigs = {
  auth: {
    timeout: 45 * 1000, // Auth tests may take longer
    retries: 1,
    use: {
      baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    },
  },
  smoke: {
    timeout: 20 * 1000,
    retries: 0,
    use: {
      baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    },
  },
  regression: {
    timeout: 60 * 1000,
    retries: 2,
    use: {
      baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    },
  },
};

/**
 * Get configuration based on environment
 */
export function getConfig(): PlaywrightTestConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
    case 'ci':
      return { ...baseConfig, ...ciConfig };
    case 'development':
    default:
      return { ...baseConfig, ...devConfig };
  }
}

/**
 * Get test-specific configuration
 */
export function getTestConfig(testType: keyof typeof testConfigs): Partial<PlaywrightTestConfig> {
  return testConfigs[testType] || {};
}

/**
 * Path configurations
 */
export const paths = {
  root: path.resolve(__dirname, '../..'),
  e2e: path.resolve(__dirname, '../..', 'e2e'),
  authTests: path.resolve(__dirname, '../..', 'e2e/auth/tests'),
  pageObjects: path.resolve(__dirname, '../..', 'e2e/auth/page-objects'),
  helpers: path.resolve(__dirname, '../..', 'e2e/auth/helpers'),
  fixtures: path.resolve(__dirname, '../..', 'e2e/fixtures'),
  testResults: path.resolve(__dirname, '../..', 'test-results'),
  screenshots: path.resolve(__dirname, '../..', 'test-results/screenshots'),
  traces: path.resolve(__dirname, '../..', 'test-results/traces'),
  videos: path.resolve(__dirname, '../..', 'test-results/videos'),
};

/**
 * Timeout configurations (in milliseconds)
 */
export const timeouts = {
  default: 30 * 1000,
  short: 5 * 1000,
  medium: 10 * 1000,
  long: 60 * 1000,
  auth: 45 * 1000,
  network: 30 * 1000,
  navigation: 15 * 1000,
};

/**
 * Test user credentials
 */
export const testUsers = {
  valid: {
    email: process.env.TEST_USER_EMAIL || 'test-user@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPass123!',
  },
  invalid: {
    email: 'invalid-email@example.com',
    password: 'WrongPassword123!',
  },
  weakPassword: {
    password: '12345',
  },
};

/**
 * Test URLs
 */
export const testUrls = {
  home: '/',
  auth: {
    callback: '/auth/callback',
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
  myVideos: '/my-videos',
  settings: '/settings',
  pricing: '/pricing',
};

/**
 * Test data
 */
export const testData = {
  youtubeUrls: {
    valid: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    short: 'https://youtu.be/dQw4w9WgXcQ',
    invalid: 'https://example.com',
  },
  emails: {
    valid: 'test@example.com',
    invalid: ['notanemail', '@example.com', 'user@', ''],
  },
  passwords: {
    valid: 'SecurePass123!',
    weak: ['12345', 'password', '', 'abc'],
  },
};

/**
 * Feature flags for tests
 */
export const featureFlags = {
  oauthEnabled: process.env.OAUTH_ENABLED !== 'false',
  emailAuthEnabled: process.env.EMAIL_AUTH_ENABLED !== 'false',
  sessionPersistence: process.env.SESSION_PERSISTENCE !== 'false',
};

/**
 * Supabase configuration
 */
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

/**
 * Get environment variable with default
 */
export function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Check if we're in CI environment
 */
export function isCI(): boolean {
  return !!process.env.CI;
}

/**
 * Check if we're in development
 */
export function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Get test timeout based on test type
 */
export function getTimeout(testType: 'smoke' | 'auth' | 'regression' = 'smoke'): number {
  return testConfigs[testType]?.timeout || timeouts.default;
}

/**
 * Get retry count based on environment
 */
export function getRetries(): number {
  return isCI() ? ciConfig.retries || 2 : devConfig.retries || 0;
}

/**
 * Should capture artifacts (screenshots, traces, videos)
 */
export function shouldCaptureArtifacts(): boolean {
  return process.env.CAPTURE_ARTIFACTS !== 'false';
}

/**
 * Get browser launch arguments
 */
export function getLaunchArgs(browser: 'chromium' | 'firefox' | 'webkit'): string[] {
  const commonArgs = ['--disable-web-security'];

  switch (browser) {
    case 'chromium':
      return [...commonArgs, '--no-sandbox', '--disable-setuid-sandbox'];
    case 'firefox':
      return commonArgs;
    case 'webkit':
      return commonArgs;
    default:
      return commonArgs;
  }
}

/**
 * Test metadata for reporting
 */
export interface TestMetadata {
  suite: string;
  feature: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  author?: string;
  description?: string;
}

/**
 * Create test metadata
 */
export function createMetadata(metadata: TestMetadata): TestMetadata {
  return metadata;
}

/**
 * Skip test based on feature flags
 */
export function skipIfFeatureDisabled(feature: keyof typeof featureFlags): void {
  if (!featureFlags[feature]) {
    test.skip(true, `Feature '${feature}' is disabled`);
  }
}
