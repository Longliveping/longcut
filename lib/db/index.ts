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
  
  dbInstance = drizzle(sqlite, { schema })
  return dbInstance
}

// Legacy exports for backward compatibility
export const db = getDb()
export default db
