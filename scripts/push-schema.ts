import { push } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../lib/db/schema'

async function main() {
  const dbPath = process.env.DATABASE_URL || './local.db'

  console.log('Pushing schema to database at:', dbPath)

  const sqlite = new Database(dbPath)

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  // Push schema to database
  console.log('Pushing schema...')
  await push(db, { schema })

  console.log('Schema pushed successfully')

  sqlite.close()
}

main().catch(console.error)
