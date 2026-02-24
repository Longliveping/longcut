import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../lib/db/schema'

const dbPath = process.env.DATABASE_URL || './local.db'

console.log('Initializing database at:', dbPath)

const sqlite = new Database(dbPath)

// Enable foreign keys
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite, { schema })

// Run migrations if available
try {
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: 'drizzle' })
  console.log('Migrations completed')
} catch (error) {
  console.log('No migrations folder or migrations already applied')
}

// Verify tables exist
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]
console.log('Tables in database:', tables.map((t: any) => t.name))

sqlite.close()
console.log('Database initialization complete')
