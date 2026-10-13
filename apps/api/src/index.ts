import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { swaggerUI } from '@hono/swagger-ui'
import openapiYaml from '../../../openapi.yaml?raw'
import type { Bindings } from './types'
import { allowedOrigins, isDev } from './config'

const app = new Hono<{ Bindings: Bindings }>()

app.use(
  cors({
    origin: (origin: string): string | null =>
      allowedOrigins.includes(origin) ? origin : null,
  }),
)

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

// /openapi.yaml と /doc はローカル開発でのみ登録する(本番ビルドでは登録しない)
if (isDev) {
  app.get('/openapi.yaml', () => {
    return new Response(openapiYaml, {
      headers: { 'Content-Type': 'text/yaml' },
    })
  })

  app.get('/doc', swaggerUI({ url: '/openapi.yaml' }))
}

export default app
