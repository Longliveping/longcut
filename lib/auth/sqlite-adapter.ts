import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Adapter } from 'better-auth/adapters'
import { db } from '../db'
import * as schema from '../db/schema'

/**
 * Custom Drizzle adapter for SQLite that handles type conversions
 * better-auth's Drizzle adapter doesn't properly convert boolean values to integers for SQLite
 */
export function sqliteDrizzleAdapter() {
  const baseAdapter = drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.users,
      session: schema.sessions,
    },
  })

  // Wrap the adapter to convert boolean values
  const wrappedAdapter: Adapter = {
    ...baseAdapter,
    create: async (data) => {
      // Convert boolean values to integers for SQLite
      if (data.user) {
        const user = { ...data.user }
        // Convert emailVerified boolean to string "0" or "1"
        if (typeof user.emailVerified === 'boolean') {
          user.emailVerified = user.emailVerified ? '1' : '0' as any
        }
        data.user = user
      }
      if (data.session) {
        const session = { ...data.session }
        // Convert any boolean fields in session if needed
        data.session = session
      }
      return baseAdapter.create(data)
    },
    update: async (data) => {
      // Convert boolean values for updates
      if (data.user) {
        const user = { ...data.user }
        if (typeof user.emailVerified === 'boolean') {
          user.emailVerified = user.emailVerified ? '1' : '0' as any
        }
        data.user = user
      }
      return baseAdapter.update(data)
    },
  }

  return wrappedAdapter
}
