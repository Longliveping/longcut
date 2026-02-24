import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

let dbInstance: ReturnType<typeof drizzle> | null = null

function getDatabasePath(): string {
  const dbPath = process.env.DATABASE_URL

  if (!dbPath) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL environment variable is required in production')
    }
    return './local.db'
  }

  return dbPath
}

export function getDb() {
  if (dbInstance) {
    return dbInstance
  }

  const dbPath = getDatabasePath()
  const sqlite = new Database(dbPath)

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON')

  // Log all SQL queries for debugging
  sqlite.function('log_sql', (sql) => {
    console.log('[SQL]', sql)
  })

  dbInstance = drizzle(sqlite, {
    schema,
    logger: true,
  })
  return dbInstance
}

// Lazy proxy so the database is only initialized on first access,
// not at module load time (which would crash during Next.js build).
export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_, prop) {
    return (getDb() as any)[prop]
  },
})
export default db
