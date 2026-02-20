/// <reference types="vitest/globals" />

declare module 'vitest' {
  interface TestContext {
    // Test-specific context can be added here
  }
}

declare global {
  // Global test utilities can be added here
}

export {}
