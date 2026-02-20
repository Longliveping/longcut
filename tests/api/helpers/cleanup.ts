/**
 * Cleanup Helper for API Testing
 * 
 * Provides centralized cleanup utilities for managing test data teardown.
 * Handles registration and execution of cleanup callbacks with error aggregation.
 */

import { getTestDbClient } from './database';
import { AuthHelper } from './auth';

// ============================================================================
// Types
// ============================================================================

export interface CleanupCallback {
  name: string;
  fn: () => Promise<void>;
}

export interface CleanupResult {
  successful: string[];
  failed: Array<{ name: string; error: string }>;
}

// ============================================================================
// Cleanup Registry
// ============================================================================

/**
 * Central registry for cleanup callbacks
 * Supports named callbacks for better error reporting
 */
class CleanupRegistry {
  private callbacks: CleanupCallback[] = [];
  private isExecuting = false;

  /**
   * Register a cleanup callback
   * Callbacks are executed in LIFO order (last registered, first executed)
   * This ensures proper dependency teardown (e.g., users before videos)
   */
  register(name: string, callback: () => Promise<void>): void {
    if (this.isExecuting) {
      throw new Error(
        'Cannot register cleanup callbacks during cleanup execution'
      );
    }
    this.callbacks.push({ name, fn: callback });
  }

  /**
   * Register multiple cleanup callbacks at once
   */
  registerMany(callbacks: CleanupCallback[]): void {
    if (this.isExecuting) {
      throw new Error(
        'Cannot register cleanup callbacks during cleanup execution'
      );
    }
    this.callbacks.push(...callbacks);
  }

  /**
   * Clear all registered callbacks without executing
   * Useful for test isolation when cleanup should be skipped
   */
  clear(): void {
    if (this.isExecuting) {
      throw new Error(
        'Cannot clear cleanup callbacks during cleanup execution'
      );
    }
    this.callbacks = [];
  }

  /**
   * Execute all registered cleanup callbacks
   * Returns results for both successful and failed cleanups
   */
  async executeAll(): Promise<CleanupResult> {
    this.isExecuting = true;
    const result: CleanupResult = {
      successful: [],
      failed: [],
    };

    // Execute in reverse order (LIFO) for proper dependency teardown
    for (const callback of [...this.callbacks].reverse()) {
      try {
        await callback.fn();
        result.successful.push(callback.name);
      } catch (error) {
        result.failed.push({
          name: callback.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear registry after execution
    this.callbacks = [];
    this.isExecuting = false;

    return result;
  }

  /**
   * Get the count of registered callbacks
   */
  get count(): number {
    return this.callbacks.length;
  }
}

// Global singleton instance
const registry = new CleanupRegistry();

// ============================================================================
// Cleanup Helper API
// ============================================================================

export class CleanupHelper {
  /**
   * Register a named cleanup callback
   * @example
   * CleanupHelper.register('delete-test-user', async () => {
   *   await deleteTestUser(userId)
   * })
   */
  static register(name: string, callback: () => Promise<void>): void {
    registry.register(name, callback);
  }

  /**
   * Register multiple cleanup callbacks
   * @example
   * CleanupHelper.registerMany([
   *   { name: 'cleanup-videos', fn: () => cleanupVideos() },
   *   { name: 'cleanup-users', fn: () => cleanupUsers() }
   * ])
   */
  static registerMany(callbacks: CleanupCallback[]): void {
    registry.registerMany(callbacks);
  }

  /**
   * Execute all registered cleanup callbacks
   * Logs failures but does not throw (cleanup should never fail tests)
   * @returns CleanupResult with successful and failed operations
   */
  static async executeAll(): Promise<CleanupResult> {
    const result = await registry.executeAll();

    // Log failures for debugging (non-blocking)
    if (result.failed.length > 0) {
      console.warn(
        `[CleanupHelper] ${result.failed.length} cleanup(s) failed:`,
        result.failed
      );
    }

    return result;
  }

  /**
   * Clear all registered callbacks without executing
   */
  static clear(): void {
    registry.clear();
  }

  /**
   * Get count of pending cleanup callbacks
   */
  static get pendingCount(): number {
    return registry.count;
  }

  // ========================================================================
  // Predefined Cleanup Operations
  // ========================================================================

  /**
   * Create a cleanup callback for deleting a test user
   */
  static deleteUser(userId: string): () => Promise<void> {
    return async () => {
      const client = getTestDbClient();
      if (!client) return;

      // Delete user relationships first (foreign key constraints)
      await client.from('user_notes').delete().eq('user_id', userId);
      await client.from('user_videos').delete().eq('user_id', userId);
      await client.from('profiles').delete().eq('id', userId);

      // Delete auth user if exists
      try {
        await AuthHelper.cleanupTestUser(userId);
      } catch {
        // Auth user may not exist, ignore
      }
    };
  }

  /**
   * Create a cleanup callback for deleting a test video analysis
   */
  static deleteVideo(videoId: string): () => Promise<void> {
    return async () => {
      const client = getTestDbClient();
      if (!client) return;

      // Delete related records first
      await client.from('user_notes').delete().eq('video_id', videoId);
      await client.from('user_videos').delete().eq('video_id', videoId);
      await client.from('video_analyses').delete().eq('id', videoId);
    };
  }

  /**
   * Create a cleanup callback for deleting multiple test users
   */
  static deleteUsers(userIds: string[]): () => Promise<void> {
    return async () => {
      for (const userId of userIds) {
        await this.deleteUser(userId)();
      }
    };
  }

  /**
   * Create a cleanup callback for deleting multiple test videos
   */
  static deleteVideos(videoIds: string[]): () => Promise<void> {
    return async () => {
      for (const videoId of videoIds) {
        await this.deleteVideo(videoId)();
      }
    };
  }

  /**
   * Create a cleanup callback for cleaning up test data by email pattern
   * Useful for orphaned test data cleanup
   */
  static cleanupByEmailPattern(
    pattern: string = '%@example.com'
  ): () => Promise<void> {
    return async () => {
      const client = getTestDbClient();
      if (!client) return;

      // Get matching users
      const { data: users, error } = await client
        .from('profiles')
        .select('id')
        .like('email', pattern);

      if (error) {
        throw new Error(`Failed to query test users: ${error.message}`);
      }

      const userIds = users?.map((u: any) => u.id) || [];

      // Delete all matching users
      await this.deleteUsers(userIds)();
    };
  }

  /**
   * Clean up all rate limit logs for test identifiers
   */
  static cleanupRateLimits(identifiers: string[]): () => Promise<void> {
    return async () => {
      const client = getTestDbClient();
      if (!client) return;

      for (const identifier of identifiers) {
        await client.from('rate_limit_logs').delete().eq('identifier', identifier);
      }
    };
  }

  /**
   * Comprehensive cleanup for a test scenario
   * Cleans up users, videos, and related data
   */
  static cleanupScenario(params: {
    userIds?: string[];
    videoIds?: string[];
    rateLimitIdentifiers?: string[];
  }): () => Promise<void> {
    return async () => {
      const operations: CleanupCallback[] = [];

      if (params.videoIds && params.videoIds.length > 0) {
        operations.push({
          name: 'delete-videos',
          fn: this.deleteVideos(params.videoIds),
        });
      }

      if (params.userIds && params.userIds.length > 0) {
        operations.push({
          name: 'delete-users',
          fn: this.deleteUsers(params.userIds),
        });
      }

      if (params.rateLimitIdentifiers && params.rateLimitIdentifiers.length > 0) {
        operations.push({
          name: 'cleanup-rate-limits',
          fn: this.cleanupRateLimits(params.rateLimitIdentifiers),
        });
      }

      // Execute all operations
      for (const op of operations) {
        await op.fn();
      }
    };
  }

  // ========================================================================
  // Test Lifecycle Helpers
  // ========================================================================

  /**
   * Run an async function with automatic cleanup
   * Cleanup is guaranteed to run even if the test throws
   * @example
   * await CleanupHelper.withCleanup(async () => {
   *   const user = await createTestUser()
   *   CleanupHelper.register('delete-user', CleanupHelper.deleteUser(user.id))
   *   // ... test code ...
   * })
   */
  static async withCleanup<T>(
    fn: () => Promise<T>
  ): Promise<T> {
    try {
      return await fn();
    } finally {
      await this.executeAll();
    }
  }

  /**
   * Create a scoped cleanup context
   * Cleanup callbacks are cleared after execution
   * @example
   * const ctx = CleanupHelper.createContext()
   * ctx.register('delete-user', deleteUser)
   * await ctx.cleanup()
   */
  static createContext(): CleanupContext {
    return new CleanupContext();
  }
}

// ============================================================================
// Cleanup Context
// ============================================================================

/**
 * Isolated cleanup context for test scoping
 * Each context maintains its own cleanup registry
 */
export class CleanupContext {
  private callbacks: CleanupCallback[] = [];

  /**
   * Register a cleanup callback in this context
   */
  register(name: string, callback: () => Promise<void>): void {
    this.callbacks.push({ name, fn: callback });
  }

  /**
   * Execute all cleanup callbacks in this context
   */
  async cleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      successful: [],
      failed: [],
    };

    for (const callback of [...this.callbacks].reverse()) {
      try {
        await callback.fn();
        result.successful.push(callback.name);
      } catch (error) {
        result.failed.push({
          name: callback.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.callbacks = [];
    return result;
  }

  /**
   * Clear all callbacks without executing
   */
  clear(): void {
    this.callbacks = [];
  }

  /**
   * Get count of pending callbacks
   */
  get count(): number {
    return this.callbacks.length;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Assert that cleanup completed successfully
 * Throws if any cleanup operations failed
 */
export function assertCleanupSuccess(result: CleanupResult): void {
  if (result.failed.length > 0) {
    throw new Error(
      `Cleanup failed for ${result.failed.length} operation(s):\n` +
        result.failed.map((f) => `  - ${f.name}: ${f.error}`).join('\n')
    );
  }
}

/**
 * Log cleanup results in a formatted way
 */
export function logCleanupResults(result: CleanupResult): void {
  const total = result.successful.length + result.failed.length;

  console.log(`[Cleanup] ${result.successful.length}/${total} operations successful`);

  if (result.failed.length > 0) {
    console.warn(`[Cleanup] ${result.failed.length} operations failed:`);
    for (const failure of result.failed) {
      console.warn(`  - ${failure.name}: ${failure.error}`);
    }
  }
}
