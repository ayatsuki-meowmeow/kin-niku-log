import { createMiddleware } from 'hono/factory'
import { createDb, type Database } from '../db'
import type { Bindings } from '../types'

export type DbVariables = {
  db: Database
}

export const dbMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: DbVariables
}>(async (c, next) => {
  c.set('db', createDb(c.env.DATABASE_URL))
  await next()
})
