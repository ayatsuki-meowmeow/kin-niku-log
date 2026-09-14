import { eq } from 'drizzle-orm'
import { db } from '../db'
import { users, UserInsert, UserSelect } from '../db/schema'

export async function getUsers(): Promise<UserSelect[]> {
  return db.select().from(users)
}

export async function getUserById(id: string): Promise<UserSelect | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  return user
}

export async function createUser(data: UserInsert): Promise<UserSelect> {
  const [user] = await db.insert(users).values(data).returning()
  if (!user) throw new Error('Failed to create user')
  return user
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id)).returning()
  return result.length > 0
}
