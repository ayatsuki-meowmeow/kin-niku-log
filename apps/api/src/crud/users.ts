import { eq } from 'drizzle-orm'
import type { Database } from '../db'
import { users, UserInsert, UserSelect } from '../db/schema'

export async function getUsers(db: Database): Promise<UserSelect[]> {
  return db.select().from(users)
}

export async function getUserById(db: Database, id: string): Promise<UserSelect | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user
}

export async function createUser(db: Database, data: UserInsert): Promise<UserSelect> {
  const [user] = await db.insert(users).values(data).returning()
  if (!user) throw new Error('Failed to create user')
  return user
}

export async function deleteUser(db: Database, id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id)).returning()
  return result.length > 0
}
