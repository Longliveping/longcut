import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import Database from 'better-sqlite3'
import { db } from './index'

export async function runMigrations() {
  await migrate(db, { migrationsFolder: './lib/db/migrations' })
  console.log('Migrations completed')
}

// Run if called directly
if (require.main === module) {
  runMigrations().then(() => process.exit(0))
}
