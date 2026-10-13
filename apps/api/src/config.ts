const LOCAL_WEB_ORIGIN = 'http://localhost:3000'
// 本番の web オリジン。apps/web/cloudflare.config.ts の name(Worker 名)とアカウントの workers.dev サブドメインから決まる。
// web の Worker 名を変えるときは、この許可オリジンも合わせて変更する
const PRODUCTION_WEB_ORIGIN = 'https://kin-niku-log.aya-ayatsuki.workers.dev'

// Vite のビルド時定数(Turborepo の環境変数ではない)なので turbo の lint ルールは対象外にする
// eslint-disable-next-line turbo/no-undeclared-env-vars
export const isDev: boolean = import.meta.env.DEV

function resolveAllowedOrigins(): string[] {
  return isDev ? [LOCAL_WEB_ORIGIN] : [PRODUCTION_WEB_ORIGIN]
}

export const allowedOrigins: string[] = resolveAllowedOrigins()
