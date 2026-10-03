# kin-niku-log プロジェクト概要

筋トレ記録アプリ。このドキュメントは、人間・AIエージェント問わず「このプロジェクトが
何を・なぜ・どう作るか」を把握するための入口となる。

## プロジェクトの目的

1. 筋トレ記録アプリを実用レベルで作る
2. バックエンド/インフラ(特に DB 設計・デプロイ周り)の学習
3. AI エージェント活用ワークフローのブラッシュアップ
   (https://github.com/ayatsuki-meowmeow/skills)

学習目的があるため、実装を全て自動化するのではなく、DB 設計など「学びたい領域」は
**人間主導**で進め、それ以外は極力自動化する方針(Human on the loop)を取る。

> エージェントへの含意: DB スキーマ設計・マイグレーション方針・認証方式などの設計判断は
> 勝手に確定させず、選択肢と根拠を示して人間の判断を仰ぐこと。

---

## 機能要件

- ログイン機能(認証)
- トレーニング記録機能
- トレーニングプラン登録機能
- タイマー機能
- トレーニング記録およびプランから、AI に渡すための定型文を生成する機能

### 機能ごとの技術的な含意(たたき台)

| 機能 | 主な技術要素 |
|---|---|
| ログイン | 認証基盤の設計・選定 |
| トレーニング記録 | DB スキーマ設計(記録テーブル)、CRUD API |
| トレーニングプラン登録 | DB スキーマ設計(プランテーブル、記録との関連設計) |
| タイマー | フロントエンドの状態管理のみで完結 |
| AI 向け定型文生成 | 既存データの整形ロジック(新規テーブル設計は不要) |

未確定・要検討:

- 認証は自前実装(Better Auth + Drizzle アダプタ想定)を軸に検討中。
  SaaS(Clerk 等)は学習目的的に見送り方向
- トレーニングプランと記録の関連設計(プラン通りにできたかの記録方法など)は未確定

---

## 技術スタック(決定事項)

もともと [next-hono-starter](https://github.com/ayatsuki-meowmeow/next-hono-starter) を
ベースにする想定だったが、Next.js の機能(SSR/SEO)は本アプリの要件上不要と判断し、
以下の構成に変更した。

| 領域 | 技術 | デプロイ先 |
|---|---|---|
| フロントエンド | Vite + React (SPA) + TanStack Router | Cloudflare Pages |
| API | Hono | Cloudflare Workers |
| DB | Neon (PostgreSQL) + Drizzle ORM | Neon (サーバーレスドライバ経由) |
| CI/CD | GitHub Actions | — |

### next-hono-starter からの流用方針

Next.js 部分は使わず、以下は流用を検討:

- `apps/api` のディレクトリ構成
- openapi スキーマファースト運用(`openapi.yaml` → 型生成 → 実装、の順序)
- Drizzle の設定・スキーマ定義の書き方
  (Postgres 方言のまま、Neon 用ドライバに接続部分のみ差し替え)

参照: https://github.com/ayatsuki-meowmeow/next-hono-starter
scaffold 各レイヤーの繋がりは [sample-users-crud.md](./sample-users-crud.md) を参照。

### Cloudflare Workers + Neon 選定理由

- Cloudflare Workers から PostgreSQL へ直接 TCP 接続はできないため、Neon のサーバーレス
  ドライバ(`@neondatabase/serverless` + `drizzle-orm/neon-http`)を使う
- Neon のブランチ機能(本番 DB の瞬時コピー)を、開発時の安全装置として積極活用する

---

## リポジトリの現状(2026-09-14 時点)

現在のコードは `next-hono-starter` の初期状態そのままであり、上記の決定事項は
**まだ反映されていない**。主な差分は以下。

| 項目 | 現状 | 目標 |
|---|---|---|
| `apps/web` | Next.js 16 | Vite + React SPA |
| `apps/api/src/db/index.ts` | `drizzle-orm/node-postgres` + `pg` | `drizzle-orm/neon-http` + `@neondatabase/serverless` |
| API ランタイム | Bun (`bun run --hot`) | Cloudflare Workers(`cf` CLI + Vite / `@cloudflare/vite-plugin`、#15) |
| ローカル DB | `docker-compose.yml` の PostgreSQL | Neon ブランチ |
| `package.json` の `name` | `freak`(starter 由来) | `kin-niku-log` |
| CI/CD | 未設定 | GitHub Actions |

monorepo は Turborepo + Bun workspaces(`apps/*`, `packages/*`)。
`packages/schema`(FE/BE 共通 Zod スキーマ)、`packages/ui`、`packages/eslint-config`、
`packages/typescript-config` は継続利用の想定。

---

## 開発ロードマップ

| Phase | 内容 | 状態 |
|---|---|---|
| Phase 1 | 技術スタックに合わせた足場整備(Vite 化 / Workers 化 / Neon 化 / `cf` CLI 移行) | 着手中(Issue #1〜#8、#15) |
| Phase 2 | 自動化の仕組み(CI/CD、hooks、design.md フォーマット、受け入れテスト生成ループ)。ハーネス・ループ設計の見直しにも比重を置く(Phase 3 で実際に動かして改善する前提) | 未着手 |
| Phase 3 | 人間が design.md を書き、機能単位で実装ループを回す | 未着手 |

- Phase 1 の完了条件: users CRUD サンプルが Vite SPA → Workers(Vite + `@cloudflare/vite-plugin` の dev サーバー) → Neon で end-to-end 動く
- Phase 2 内では CI(PR 時チェック)を最初に入れ、以降の作業に安全網をかける
- DB スキーマの検討(人間の学習領域)は Phase 2 と並行して進められる。
  ただし design.md フォーマットの確定は先に済ませる

## タスク管理の運用

- タスク管理は **GitHub Issues** で行う
  - ラベル: `phase-N`(所属 Phase)、`human`(人間担当)、`ai`(AI エージェント担当)
  - タイトルは `[PN] 〜` の形式
- Issue ごとの設計書・実装計画は `docs/issues/<Issue 番号>-<slug>/` に置く
  - `design.md`: 設計(何を・なぜ)
  - `plan.md`: 実装計画(どう進めるか)
  - フォーマットは Phase 2 で確定する。それまでは自由形式で良い
- 設計判断を伴わない小さな Issue(メタ整備など)は docs ディレクトリを作らなくてよい
- Issue ごとにブランチ(必要に応じて worktree)を切って作業する

## Phase 1 の推奨着手順

Issue 番号順ではなく、人間タスクを先に投げて AI タスクを並行させる。

```
今すぐ  #1 Neon  ┐ 人間・外部サービス待ちが出るので最初に投げる
        #2 CF    ┘ (#2 は wrangler.toml の name 決めだけなので軽い)
          │
Step 1  #3 メタ整備     ← .gitignore を #5 より先に入れる必要がある
          │
Step 2  #4 web Vite 化  ║  #5 api Workers 化   ← 並行可(#5 は #2 の name 待ち)
          │             ║      │
Step 3    │             ║  #6 Neon ドライバ    ← #1 の接続文字列が必要
          │             ║      │
Step 4    └─────────────╩─ #7 ローカル環境切替
                             │
Step 5                     #8 E2E + docs
```

順序を決めるうえでの制約:

- **`#3` は `#5` より先**: `#5` で作る `.dev.vars` に Neon の接続文字列が入るため、
  `.gitignore` への追加が先に済んでいないと誤コミットのリスクがある
- **`turbo.json` は `#3` では触らない**: `outputs` を `.next/**` → `dist/**` に変えるのは
  `#4` / `#5` 側で行う。`#3` で先に変えると `#4` のマージまで設定と実態がずれる
- **`bun.lock` は `#4` と `#5` で必ず衝突する**: 変更量の大きい `#4` を先にマージし、
  `#5` は rebase 後に `bun install` で lock を再生成する
- `#4`(web)と `#5`〜`#6`(api)は触るディレクトリが分かれるため、worktree で並行させる
  価値が最も大きいペア

---

## 開発ワークフロー・安全設計の方針

### 1. 破壊的操作の機械的ブロック(hooks)

プロンプト指示(CLAUDE.md への記述)だけでは不十分なため、Claude Code の PreToolUse
フック等で物理的にブロックする仕組みを導入する。

- マイグレーション実行前に SQL 差分を静的解析し、`DROP COLUMN` / `DROP TABLE` /
  破壊的な `ALTER ... TYPE` を検知したら強制停止(exit 1)
- 本番デプロイコマンド(例: `cf deploy`)も同様にフックで検知し、
  明示フラグが無い限りブロック

リポジトリ https://github.com/ayatsuki-meowmeow/skills の `hooks/` 配下に追加していく想定。

### 2. CI/CD

- PR 時: lint / typecheck / test を自動実行
- main merge 時: `apps/web` → Cloudflare Pages、`apps/api` → Cloudflare Workers へ自動デプロイ
- **本番マイグレーション適用のみ** GitHub Environments の Required reviewers 機能で
  人間承認を挟む(Human on the loop の主要な実装ポイント)

### 3. 受け入れ条件の厳格化(TDD 的アプローチ)

- design.md から受け入れテスト(失敗する状態のテストコード)を別 subagent が先に生成
- 人間がテスト内容をレビュー・承認
- 実装エージェントには仕様と失敗するテストのみ渡し、テストの意図やヒントは渡さない
- `implement-review-loop` のステップ 0(テスト生成)として組み込む想定

### 4. Human on the loop の設計

人間が介入するポイントを以下の 3 箇所に絞る想定:

1. 設計方針の分岐点(design.md 作成時、特に DB スキーマ設計)
2. 受け入れテストの承認
3. 本番デプロイ・破壊的マイグレーションの承認

それ以外(実装・レビュー・修正ループ)は自動で回す。

---

## 既存スキルセットとの接続

https://github.com/ayatsuki-meowmeow/skills の以下のスキルを流用・拡張する:

- `subagent-orchestration` / `design-impl-docs` / `implement-review-loop` / `code-review-agent`
  → 既存の開発ループをそのまま活用
- `commit-workflow` / `ts-type-safety` / `function-signature-typing`
  → コーディング規約として継続使用

今回のプロジェクトを通じて追加・検討したいスキル:

- `schema-first-workflow`: `openapi.yaml` 起点の実装順序を強制
- `db-migration-safety`: 破壊的マイグレーションの検知・ブロック(hooks と連携)
- `neon-branch-workflow`: 開発は必ず Neon ブランチ上で行う運用の徹底

---

## 未決定事項(次のステップで詰める)

- [x] 認証方式: Better Auth で確定(2026-09-14)。実装は Phase 3
- [ ] DB スキーマのたたき台作成(`users` / `training_plans` / `training_records` を軸に検討中)
- [ ] トレーニングプランと記録の関連設計
- [x] monorepo 構成: Turborepo + Bun workspaces を維持(2026-09-14)
- [ ] design.md のフォーマット確定
