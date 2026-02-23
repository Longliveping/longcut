import { betterAuth } from 'better-auth'
import { betterSqlite3 } from 'better-auth/adapters/better-sqlite3'
import Database from 'better-sqlite3'

const getDatabase = () => {
  const dbPath = process.env.DATABASE_URL
  if (!dbPath) {
    return new Database('./local.db')
  }
  return new Database(dbPath)
}

export const auth = betterAuth({
  database: betterSqlite3(getDatabase(), {
    user: 'users',
    session: 'sessions',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    cookiePrefix: 'longcut',
    crossSubDomainCookies: {
      enabled: false,
    },
  },
})

export const authClient = auth

export type Session = typeof auth.$Infer.Session
