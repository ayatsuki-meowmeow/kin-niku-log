import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createUserSchema } from '@repo/schema'
import { getUsers, getUserById, createUser, deleteUser } from '../crud'
import { dbMiddleware, type DbVariables } from '../middleware/db'
import type { Bindings } from '../types'

const users = new Hono<{ Bindings: Bindings; Variables: DbVariables }>()

users.use('*', dbMiddleware)

users.get('/', async (c) => {
  const result = await getUsers(c.get('db'))
  return c.json(result)
})

users.post('/', zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json')
  const user = await createUser(c.get('db'), data)
  return c.json(user, 201)
})

users.get('/:id', async (c) => {
  const user = await getUserById(c.get('db'), c.req.param('id'))
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(user)
})

users.delete('/:id', async (c) => {
  const deleted = await deleteUser(c.get('db'), c.req.param('id'))
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return new Response(null, { status: 204 })
})

export { users }
