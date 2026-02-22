import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'

export async function createUser(data: {
  email: string
  passwordHash: string
  name?: string
}) {
  const now = Math.floor(Date.now() / 1000)
  const user = {
    id: crypto.randomUUID(),
    email: data.email,
    emailVerified: false,
    passwordHash: data.passwordHash,
    name: data.name || null,
    image: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.insert(users).values(user)
  return user
}

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email))
  return result[0] || null
}

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id))
  return result[0] || null
}

export async function updateUser(userId: string, data: { name?: string }) {
  const now = Math.floor(Date.now() / 1000)
  const result = await db.update(users)
    .set({ ...data, updatedAt: now })
    .where(eq(users.id, userId))
    .returning()
  return result[0] || null
}
