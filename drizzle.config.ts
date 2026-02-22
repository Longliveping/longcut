import type { Config } from 'drizzle-kit'

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'sqlite',
  // Note: 'driver' field not included - Drizzle Kit v0.31.9+ automatically uses better-sqlite3 for SQLite dialect
  dbCredentials: {
    url: process.env.DATABASE_URL || './local.db',
  },
} satisfies Config
