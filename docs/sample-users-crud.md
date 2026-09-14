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
apps/api/src/crud/            ← DB 操作関数
apps/api/src/routes/          ← Hono ルーティング

apps/web/app/page.tsx         ← 画面 (TanStack Query + React Hook Form)
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

### CRUD 関数

`apps/api/src/crud/users.ts`

```ts
getUsers()        // SELECT
getUserById(id)   // SELECT WHERE id = ?
createUser(data)  // INSERT RETURNING
deleteUser(id)    // DELETE RETURNING (件数で存在確認)
```

### ルーティング (Hono)

`apps/api/src/routes/users.ts`

```ts
users.get('/', ...)                              // GET /users
users.post('/', zValidator('json', schema), ...) // POST /users  ← Zod でバリデーション
users.get('/:id', ...)                           // GET /users/:id
users.delete('/:id', ...)                        // DELETE /users/:id
```

`zValidator` に `@repo/schema` の `createUserSchema` を渡すことで、リクエストボディを自動バリデーションしている。

### Swagger UI

開発中は `http://localhost:8080/doc` で全エンドポイントを確認・試打できる。

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

`apps/web/app/page.tsx` を参考にする。

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

`apps/api/scripts/seed.sample.ts` をコピーして使う。

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
5. `apps/api/src/routes/` にルートを追加 → `src/index.ts` で `app.route()` に登録
6. `apps/web` で `bun run generate` → 生成された hooks を画面から呼ぶ
