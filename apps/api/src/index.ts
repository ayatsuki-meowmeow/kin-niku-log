import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { swaggerUI } from '@hono/swagger-ui'
import openapiYaml from '../../../openapi.yaml?raw'
import type { Bindings } from './types'

const LOCAL_WEB_ORIGIN = 'http://localhost:3000'
// 本番の web オリジン。apps/web/cloudflare.config.ts の name(Worker 名)とアカウントの workers.dev サブドメインから決まる。
// web の Worker 名を変えるときは、この許可オリジンも合わせて変更する
const PRODUCTION_WEB_ORIGIN = 'https://kin-niku-log.aya-ayatsuki.workers.dev'

// Vite のビルド時定数(Turborepo の環境変数ではない)なので turbo の lint ルールは対象外にする
// eslint-disable-next-line turbo/no-undeclared-env-vars
const isDev: boolean = import.meta.env.DEV

function resolveAllowedOrigins(): string[] {
  return isDev ? [LOCAL_WEB_ORIGIN] : [PRODUCTION_WEB_ORIGIN]
}

const allowedOrigins: string[] = resolveAllowedOrigins()

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
