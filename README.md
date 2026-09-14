# next-hono-starter

Next.js + Hono のモノレポ scaffold。個人開発・学習用途を想定。

## 技術スタック

| 領域 | 技術 |
|------|------|
| モノレポ | Turborepo |
| パッケージマネージャー / API ランタイム | Bun |
| フロントエンド | Next.js 16 / React 19 |
| バックエンド | Hono |
| DB | PostgreSQL |
| ORM | Drizzle ORM |
| 状態管理 / データフェッチ | TanStack Query |
| フォーム | React Hook Form + Zod |
| UI | shadcn/ui + Tailwind CSS v4 |
| スキーマ定義 | OpenAPI (スキーマファースト) |
| 型生成（API） | openapi-typescript |
| 型生成（FE クライアント） | orval |

## ディレクトリ構成

```
.
├── apps/
│   ├── api/          # Hono バックエンド (port 8080)
│   └── web/          # Next.js フロントエンド (port 3000)
├── packages/
│   ├── schema/       # FE/BE 共通 Zod スキーマ
│   ├── ui/           # shadcn/ui コンポーネント
│   ├── eslint-config/
│   └── typescript-config/
├── docs/             # ガイド・意思決定メモ
├── openapi.yaml      # API スキーマ定義（唯一の正とする）
└── docker-compose.yml
```

## セットアップ

### 前提

- Bun がインストール済みであること
- Docker が起動していること

### 手順

```bash
# 依存関係のインストール
bun install

# API の環境変数を設定
cp apps/api/.env.sample apps/api/.env

# PostgreSQL を起動
docker compose up -d

# マイグレーションファイルを生成して適用
cd apps/api
bunx drizzle-kit generate
bunx drizzle-kit migrate

# 開発サーバーを起動
cd ../..
bun dev
```

- フロントエンド: http://localhost:3000
- バックエンド: http://localhost:8080
- Swagger UI: http://localhost:8080/doc

## コマンド一覧

| コマンド | 内容 |
|----------|------|
| `bun dev` | 全アプリの開発サーバー起動 |
| `bun build` | 全アプリのビルド |
| `bun lint` | 全アプリの lint |
| `bun check-types` | 全アプリの型チェック |
| `bun format` | コード整形 (Prettier) |

### apps/api

| コマンド | 内容 |
|----------|------|
| `bun run generate` | `openapi.yaml` から TypeScript 型を生成 |
| `bunx drizzle-kit generate` | スキーマ変更からマイグレーションファイルを生成 |
| `bunx drizzle-kit migrate` | マイグレーションを適用 |
| `bun run sample-seed` | サンプルデータを投入 |

### apps/web

| コマンド | 内容 |
|----------|------|
| `bun run generate` | orval で API クライアント (TanStack Query hooks) を生成 |

## 新しいエンドポイントを追加する流れ

このリポジトリはスキーマファーストを採用しているため、必ず `openapi.yaml` の編集から始める。

```
1. openapi.yaml にエンドポイントを追記
      ↓
2. apps/api で型を生成
   bun run generate
      ↓
3. apps/api/src/db/schema/ に Drizzle スキーマを追加
      ↓
4. マイグレーションファイルを生成・適用
   bunx drizzle-kit generate
   bunx drizzle-kit migrate
      ↓
5. apps/api/src/routes/ にルートを実装
      ↓
6. apps/web で API クライアントを再生成
   bun run generate
      ↓
7. apps/web/src/ で生成された hooks を使って画面を実装
```

## 共通スキーマを追加する流れ

FE/BE 両方で使う Zod スキーマは `packages/schema/src/` に定義する。

```ts
// packages/schema/src/index.ts に追記
export const mySchema = z.object({ ... })
```

各アプリから `@repo/schema` としてインポートできる。

## ドキュメント

- [サンプル: users CRUD](docs/sample-users-crud.md) — 各レイヤーの繋がりを users の実装例で解説
