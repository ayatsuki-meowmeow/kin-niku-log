import { drizzle } from 'drizzle-orm/neon-http'

export type Database = ReturnType<typeof drizzle>

export function createDb(databaseUrl: string): Database {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')
  return drizzle(databaseUrl)
}
