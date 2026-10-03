import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { swaggerUI } from '@hono/swagger-ui'
import openapiYaml from '../../../openapi.yaml?raw'
import { users } from './routes/users'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.use(cors())

app.get('/openapi.yaml', () => {
  return new Response(openapiYaml, {
    headers: { 'Content-Type': 'text/yaml' },
  })
})

app.get('/doc', swaggerUI({ url: '/openapi.yaml' }))

app.route('/users', users)

export default app
