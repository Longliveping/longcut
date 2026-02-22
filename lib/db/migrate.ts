import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db } from './index'

export async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: './lib/db/migrations' })
    console.log('Migrations completed successfully')
    return { success: true }
  } catch (error) {
    console.error('Migration failed:', error)
    return { success: false, error }
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then((result) => {
      if (result.success) {
        process.exit(0)
      } else {
        console.error('Exiting due to migration failure')
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('Unexpected error during migration:', error)
      process.exit(1)
    })
}
