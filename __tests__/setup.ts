import { vi } from 'vitest'

// Global test setup for API testing

// Mock environment variables for tests
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Suppress console output during tests unless explicitly needed
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeEach(() => {
  // Restore original console methods before each test
  console.log = originalConsoleLog
  console.error = originalConsoleError
})

// Clean up after all tests
afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog
  console.error = originalConsoleError
})
