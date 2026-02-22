import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema'

const dbPath = process.env.DATABASE_URL || './local.db'

const sqlite = new Database(dbPath)

// Enable foreign keys
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export default db
