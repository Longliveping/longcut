/**
 * Environment Configuration
 * Environment-specific settings for E2E tests
 */

export interface EnvironmentConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey?: string;
  headless: boolean;
  retries: number;
  timeout: number;
  slowMo: number;
  video: 'on' | 'off' | 'retain-on-failure';
  trace: 'on' | 'off' | 'retain-on-failure' | 'on-first-retry';
  screenshot: 'off' | 'on' | 'only-on-failure';
}

/**
 * Development environment configuration
 */
export const development: EnvironmentConfig = {
  name: 'development',
  baseUrl: 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  headless: false,
  retries: 0,
  timeout: 30000,
  slowMo: 0,
  video: 'off',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
};

/**
 * Staging environment configuration
 */
export const staging: EnvironmentConfig = {
  name: 'staging',
  baseUrl: process.env.STAGING_URL || 'https://staging.longcut.app',
  supabaseUrl: process.env.STAGING_SUPABASE_URL || '',
  supabaseAnonKey: process.env.STAGING_SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.STAGING_SUPABASE_SERVICE_KEY,
  headless: true,
  retries: 1,
  timeout: 45000,
  slowMo: 0,
  video: 'retain-on-failure' as any,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
};

/**
 * Production environment configuration
 */
export const production: EnvironmentConfig = {
  name: 'production',
  baseUrl: process.env.PRODUCTION_URL || 'https://longcut.app',
  supabaseUrl: process.env.PRODUCTION_SUPABASE_URL || '',
  supabaseAnonKey: process.env.PRODUCTION_SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.PRODUCTION_SUPABASE_SERVICE_KEY,
  headless: true,
  retries: 2,
  timeout: 60000,
  slowMo: 0,
  video: 'retain-on-failure' as any,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
};

/**
 * CI environment configuration
 */
export const ci: EnvironmentConfig = {
  name: 'ci',
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  supabaseUrl: process.env.CI_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.CI_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.CI_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  headless: true,
  retries: 2,
  timeout: 45000,
  slowMo: 0,
  video: 'retain-on-failure' as any,
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
};

/**
 * Local development environment configuration
 */
export const local: EnvironmentConfig = {
  name: 'local',
  baseUrl: process.env.LOCAL_URL || 'http://localhost:3000',
  supabaseUrl: process.env.LOCAL_SUPABASE_URL || 'http://localhost:54321',
  supabaseAnonKey: process.env.LOCAL_SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.LOCAL_SUPABASE_SERVICE_KEY,
  headless: false,
  retries: 0,
  timeout: 30000,
  slowMo: 50,
  video: 'off',
  trace: 'on',
  screenshot: 'on',
};

/**
 * All environments
 */
export const environments: Record<string, EnvironmentConfig> = {
  development,
  staging,
  production,
  ci,
  local,
};

/**
 * Get current environment configuration
 */
export function getEnvironment(env?: string): EnvironmentConfig {
  const environmentName = env || process.env.NODE_ENV || process.env.TEST_ENV || 'development';

  if (environmentName in environments) {
    return environments[environmentName];
  }

  // Default to development
  console.warn(`Unknown environment: ${environmentName}, falling back to development`);
  return development;
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback: string = ''): string {
  return process.env[key] || fallback;
}

/**
 * Get numeric environment variable
 */
export function getEnvNumber(key: string, fallback: number = 0): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : fallback;
}

/**
 * Get boolean environment variable
 */
export function getEnvBoolean(key: string, fallback: boolean = false): boolean {
  const value = process.env[key];
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return fallback;
}

/**
 * Feature flags per environment
 */
export const featureFlags = {
  development: {
    oauth: true,
    emailAuth: true,
    analytics: false,
    debugging: true,
  },
  staging: {
    oauth: true,
    emailAuth: true,
    analytics: true,
    debugging: true,
  },
  production: {
    oauth: true,
    emailAuth: true,
    analytics: true,
    debugging: false,
  },
  ci: {
    oauth: true,
    emailAuth: true,
    analytics: false,
    debugging: false,
  },
  local: {
    oauth: true,
    emailAuth: true,
    analytics: false,
    debugging: true,
  },
};

/**
 * Get feature flags for current environment
 */
export function getFeatureFlags(env?: string): Record<string, boolean> {
  const environment = getEnvironment(env);
  return featureFlags[environment.name as keyof typeof featureFlags] || featureFlags.development;
}

/**
 * Test user credentials per environment
 */
export const testCredentials = {
  development: {
    email: 'test-dev@example.com',
    password: 'TestDev123!',
  },
  staging: {
    email: process.env.STAGING_TEST_USER_EMAIL || 'test-staging@example.com',
    password: process.env.STAGING_TEST_USER_PASSWORD || 'TestStaging123!',
  },
  production: {
    email: process.env.PRODUCTION_TEST_USER_EMAIL || '',
    password: process.env.PRODUCTION_TEST_USER_PASSWORD || '',
  },
  ci: {
    email: process.env.CI_TEST_USER_EMAIL || 'test-ci@example.com',
    password: process.env.CI_TEST_USER_PASSWORD || 'TestCI123!',
  },
  local: {
    email: 'test-local@example.com',
    password: 'TestLocal123!',
  },
};

/**
 * Get test credentials for current environment
 */
export function getTestCredentials(env?: string): { email: string; password: string } {
  const environment = getEnvironment(env);
  return testCredentials[environment.name as keyof typeof testCredentials] || testCredentials.development;
}

/**
 * OAuth provider settings per environment
 */
export const oauthProviders = {
  google: {
    enabled: true,
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  github: {
    enabled: process.env.GITHUB_OAUTH_ENABLED === 'true',
    clientId: process.env.GITHUB_CLIENT_ID || '',
  },
  microsoft: {
    enabled: process.env.MICROSOFT_OAUTH_ENABLED === 'true',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
  },
};

/**
 * Get enabled OAuth providers
 */
export function getEnabledOAuthProviders(): string[] {
  return Object.entries(oauthProviders)
    .filter(([_, config]) => config.enabled)
    .map(([provider]) => provider);
}

/**
 * Browser configuration per environment
 */
export const browserConfigs = {
  development: {
    browsers: ['chromium'],
    headless: false,
    slowMo: 0,
    devtools: true,
  },
  staging: {
    browsers: ['chromium', 'firefox', 'webkit'],
    headless: true,
    slowMo: 0,
    devtools: false,
  },
  production: {
    browsers: ['chromium', 'firefox', 'webkit'],
    headless: true,
    slowMo: 0,
    devtools: false,
  },
  ci: {
    browsers: ['chromium'],
    headless: true,
    slowMo: 0,
    devtools: false,
  },
  local: {
    browsers: ['chromium'],
    headless: false,
    slowMo: 50,
    devtools: true,
  },
};

/**
 * Get browser configuration for current environment
 */
export function getBrowserConfig(env?: string): {
  browsers: string[];
  headless: boolean;
  slowMo: number;
  devtools: boolean;
} {
  const environment = getEnvironment(env);
  return browserConfigs[environment.name as keyof typeof browserConfigs] || browserConfigs.development;
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing: string[] = [];
  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Log environment information
 */
export function logEnvironmentInfo(): void {
  const env = getEnvironment();
  console.log('=== Test Environment ===');
  console.log(`Name: ${env.name}`);
  console.log(`Base URL: ${env.baseUrl}`);
  console.log(`Headless: ${env.headless}`);
  console.log(`Timeout: ${env.timeout}ms`);
  console.log(`Retries: ${env.retries}`);
  console.log('========================');
}

/**
 * Export default environment
 */
export default getEnvironment();
