import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createUserSchema } from '@repo/schema'
import { getUsers, getUserById, createUser, deleteUser } from '../crud'

const users = new Hono()

users.get('/', async (c) => {
  const result = await getUsers()
  return c.json(result)
})

users.post('/', zValidator('json', createUserSchema), async (c) => {
  const data = c.req.valid('json')
  const user = await createUser(data)
  return c.json(user, 201)
})

users.get('/:id', async (c) => {
  const user = await getUserById(c.req.param('id'))
  if (!user) return c.json({ error: 'Not found' }, 404)
  return c.json(user)
})

users.delete('/:id', async (c) => {
  const deleted = await deleteUser(c.req.param('id'))
  if (!deleted) return c.json({ error: 'Not found' }, 404)
  return new Response(null, { status: 204 })
})

export { users }
