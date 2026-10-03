# サンプル: users CRUD

scaffold に含まれている users の CRUD 実装を例に、各レイヤーがどう繋がっているかを説明する。

## 全体像

```
openapi.yaml
  │
  ├─ (openapi-typescript) ──→ apps/api/src/generated/api.d.ts   [API 側の型]
  │
  └─ (orval) ──────────────→ apps/web/src/generated/           [FE 側の型 + hooks]

packages/schema/src/index.ts  ← FE/BE 共通の Zod バリデーションスキーマ

apps/api/src/db/schema/       ← Drizzle テーブル定義 (DB の正)
apps/api/src/db/index.ts      ← createDb(): drizzle (neon-http) の生成
apps/api/src/middleware/db.ts ← リクエストごとに createDb(c.env.DATABASE_URL) を呼び c.set('db') に載せる
apps/api/src/crud/            ← DB 操作関数 (db を第 1 引数で受け取る)
apps/api/src/routes/          ← Hono ルーティング (c.get('db') で DB を取得)

apps/web/src/routes/index.tsx ← 画面 (TanStack Router のルート + TanStack Query + React Hook Form)
apps/web/src/router.tsx       ← ルートツリーの登録
```

---

## 1. openapi.yaml — スキーマ定義

```yaml
paths:
  /users:
    get:   # ユーザー一覧取得
    post:  # ユーザー作成
  /users/{id}:
    get:    # ID 指定取得
    delete: # 削除

components:
  schemas:
    User:
      # id / name / email / createdAt / updatedAt
    CreateUserRequest:
      # name / email
```

**ポイント**: `openapi.yaml` が唯一の正。BE・FE ともにここから型を生成するため、まずここを編集する。

---

## 2. packages/schema — 共通 Zod スキーマ

`packages/schema/src/index.ts`

```ts
export const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
})
```

`@repo/schema` として BE・FE 両方からインポートできる。  
BE では `zValidator` のバリデーションスキーマとして、FE では `zodResolver` のフォームバリデーションとして使う。

---

## 3. apps/api — バックエンド

### DB スキーマ (Drizzle)

`apps/api/src/db/schema/users.ts`

```ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type UserInsert = typeof users.$inferInsert
export type UserSelect = typeof users.$inferSelect
```

スキーマを変更したら以下でマイグレーションを生成・適用する。

```bash
cd apps/api
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

### DB 接続 (middleware)

Workers ではリクエストごとに環境変数(Bindings)から接続するため、DB は middleware 経由で渡す。

- `apps/api/src/db/index.ts`: `createDb(databaseUrl)` が `drizzle-orm/neon-http` の `Database` を返す
- `apps/api/src/middleware/db.ts`: `c.env.DATABASE_URL` から `createDb` を呼び、`c.set('db', ...)` に載せる
- `apps/api/src/routes/users.ts` で `users.use('*', dbMiddleware)` として適用する
- `DATABASE_URL` はローカルでは `apps/api/.dev.vars`(テンプレートは `.dev.vars.example`)から読まれる

### CRUD 関数

`apps/api/src/crud/users.ts`

```ts
getUsers(db)           // SELECT
getUserById(db, id)    // SELECT WHERE id = ?
createUser(db, data)   // INSERT RETURNING
deleteUser(db, id)     // DELETE RETURNING (件数で存在確認)
```

いずれも第 1 引数で `Database` を受け取る。

### ルーティング (Hono)

`apps/api/src/routes/users.ts`

```ts
users.use('*', dbMiddleware)                     // DB を c.set('db') に載せる
users.get('/', ...)                              // GET /users
users.post('/', zValidator('json', schema), ...) // POST /users  ← Zod でバリデーション
users.get('/:id', ...)                           // GET /users/:id
users.delete('/:id', ...)                        // DELETE /users/:id
```

各ハンドラは `c.get('db')` で取得した `Database` を crud 関数に渡す
(例: `getUsers(c.get('db'))`)。
`zValidator` に `@repo/schema` の `createUserSchema` を渡すことで、リクエストボディを自動バリデーションしている。
`apps/api/src/index.ts` で `app.route('/users', users)` として登録している。

### Swagger UI

開発中は `http://localhost:8080/doc` で全エンドポイントを確認・試打できる。
スキーマ本体は `http://localhost:8080/openapi.yaml` で配信される(`openapi.yaml` を `?raw` で取り込んでいる)。

---

## 4. apps/web — フロントエンド

### API クライアントの生成 (orval)

`openapi.yaml` から TanStack Query の hooks を自動生成する。

```bash
cd apps/web
bun run generate
```

生成先: `apps/web/src/generated/`

| ファイル | 内容 |
|----------|------|
| `model/user.ts` | `User` 型 |
| `model/createUserRequest.ts` | `CreateUserRequest` 型 |
| `users/users.ts` | `useGetUsers` / `useCreateUser` / `useDeleteUser` 等の hooks |

生成されたファイルは**手動で編集しない**。

### 画面での使い方

`apps/web/src/routes/index.tsx` を参考にする(`createRoute` で定義し、`src/router.tsx` の
`routeTree` に登録されている)。API の呼び出しは `apps/web/src/lib/fetcher.ts` が担い、
接続先は `VITE_API_URL`(未設定時は `http://localhost:8080`)。

**データ取得**

```ts
const { data, isLoading } = useGetUsers()
const users = data?.data ?? []
```

**作成 (フォームと組み合わせ)**

```ts
const { mutate: createUser } = useCreateUser({
  mutation: {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() })
      reset()
    },
  },
})

// React Hook Form + zodResolver で @repo/schema のスキーマを共有
const { register, handleSubmit } = useForm<CreateUserInput>({
  resolver: zodResolver(createUserSchema),
})

// 送信
handleSubmit((values) => createUser({ data: values }))
```

**削除**

```ts
const { mutate: deleteUser } = useDeleteUser({
  mutation: { onSuccess: () => queryClient.invalidateQueries(...) },
})

deleteUser({ id: user.id })
```

---

## 5. シードデータ

`apps/api/scripts/seed.sample.ts` をコピーして使う(`.dev.vars` を読み込んで実行される)。

```bash
cd apps/api
bun run sample-seed
```

実際のプロジェクト用シードは `scripts/seed.ts` を作って同様に定義する。

---

## 新しいリソースを追加するときの参照順

1. `openapi.yaml` にパスとスキーマを追記
2. `packages/schema/src/index.ts` に Zod スキーマを追加
3. `apps/api/src/db/schema/` に Drizzle テーブルを追加 → migrate
4. `apps/api/src/crud/` に DB 操作関数を追加
5. `apps/api/src/routes/` にルートを追加(`dbMiddleware` を適用し `c.get('db')` を使う)
   → `src/index.ts` で `app.route()` に登録
6. `apps/web` で `bun run generate` → 生成された hooks を `src/routes/` の画面から呼ぶ
   (新規ルートは `src/router.tsx` の `routeTree` に追加)
