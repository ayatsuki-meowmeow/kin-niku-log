import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { swaggerUI } from '@hono/swagger-ui'
import { join } from 'path'
import { users } from './routes/users'

const app = new Hono()

app.use(cors())

app.get('/openapi.yaml', async (c) => {
  const file = Bun.file(join(import.meta.dir, '../../../openapi.yaml'))
  return new Response(await file.text(), {
    headers: { 'Content-Type': 'text/yaml' },
  })
})

app.get('/doc', swaggerUI({ url: '/openapi.yaml' }))

app.route('/users', users)

export default {
  port: 8080,
  fetch: app.fetch,
}
