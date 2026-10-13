# #20 機能実装前に本番環境へ初回デプロイ — impl.md

- 仕様・決定の出典: `docs/issues/20-initial-deploy/design.md`(決定事項 D1〜D23)。この文書は方針の置き場で、仕様は design.md が正
- 状態: 実装・PR #21 のマージ済み。2026-10-13 に本番デプロイし、確認結果を実装状況 #12・#13 に記録

## 実装状況

| # | 項目 | 状態 | 結果(確認日と確認した事実) |
|---|---|---|---|
| 1 | 事前確認(下の「実装時に確認すること」) | 完了(確認事項 4 は任意のため未確認) | 2026-10-12: 確認事項 1・2 は D16・D17 で対応済み。残るのは確認事項 4(任意)と、Version URL が残るか(`cf deploy` しないと確認できない)だけ。2026-10-13: Version URL はデプロイ後に発行されていないことを確認(#13)。`workers.dev` サブドメインは `aya-ayatsuki.workers.dev` と確定(ユーザーがダッシュボードで確認)。web は `https://kin-niku-log.aya-ayatsuki.workers.dev`、api は `https://kin-niku-log-api.aya-ayatsuki.workers.dev` |
| 2 | api: `/users` のルート登録を外す | 完了 | 2026-10-12: `app.route('/users', users)` と import を削除。ローカルで `/users` が 404 |
| 3 | api: `GET /health` の追加 | 完了 | 2026-10-12: `{"status":"ok"}` を 200 で返す(ローカルで確認) |
| 4 | api: `/doc`・`/openapi.yaml` を本番で無効化(D9) | 完了 | 2026-10-12: `isDev`(`import.meta.env.DEV`)の条件で登録。ローカルは両方 200。v2 の Build Output(`.cloudflare/output/v0/workers/default/bundle/index.js`)で確認: 登録ルートは `/health` のみ、`isDev` の分岐はビルド時に除去、`openapi.yaml` の中身・`/users`・`localhost:3000` は含まれない。`@hono/swagger-ui` は import が残るためモジュールの定数オブジェクトだけがバンドルに残るが、UI の HTML やルートは含まれない |
| 5 | api: CORS の許可オリジンを環境で切り替える(D10) | 完了 | 2026-10-12: ビルド時定数方式。`isDev` ならローカル `http://localhost:3000`、そうでなければ `PRODUCTION_WEB_ORIGIN`(`apps/api/src/config.ts` の定数 1 箇所。D23 で `index.ts` から移した、`https://kin-niku-log.aya-ayatsuki.workers.dev`)。ローカルで `Origin: http://localhost:3000` には `access-control-allow-origin` が付き、別オリジンには付かない。許可オリジンは本番 web の URL のみ(上の #4 の bundle で確認)。値は確定済みなので未設定ビルドの扱い(失敗/全拒否)は発生しない |
| 6 | api: プレビュー URL(`previewUrls`)の無効化(D15) | 完了 | 2026-10-12: `cloudflare.config.ts` の `worker.previewUrls: false`。v2 の `workers/default/worker.config.json` に `previewUrls:false` が反映される。型定義上の既定値も `false` |
| 7 | web: `/` をプレースホルダーに差し替え(D1・D8) | 完了 | 2026-10-12: `apps/web/src/routes/index.tsx` を Hello World に差し替え(API を呼ばない)。lint / check-types / build 通過 |
| 8 | web: 静的アセットだけの Worker `kin-niku-log` の設定(プレビュー URL の無効化を含む、D7・D15) | 完了 | 2026-10-12: `apps/web/cloudflare.config.ts`(name・compatibilityDate・`assets.notFoundHandling: "single-page-application"`・`previewUrls: false`)、`vite.config.ts` に `cloudflare()` を組み込み、D17 で web に `cf` を追加。`eslint.config.js` に `.cloudflare/**` の ignore を追加 |
| 9 | docs: `sample-users-crud.md` に冒頭の注記を置き、節 3(`/users` の登録・Swagger UI)と節 4(`routes/index.tsx` の参照)を個別に直す(D14) | 完了 | 2026-10-12: 冒頭の注記と 3 箇所の個別修正を実施。2026-10-13: 「全体像」の図の画面の行、本番で登録しない理由、「画面での使い方」の段落も修正(コードレビュー第 2 周 G3〜G5)。同日、「画面での使い方」の時制を修正(第 3 周 H1、D22) |
| 10 | `cf build` / `cf deploy --dry-run` での事前確認(D16・D17) | 完了 | 2026-10-12: api は `cf build` 成功、`cf deploy --dry-run` 成功(Total Upload 56.04 KiB、`No bindings found.`)。web は D17 実施後に `cf build` 成功、`cf deploy --dry-run` 成功(Total Upload 0.00 KiB、`No bindings found.`)。詳細は「確認できたこと」 |
| 11 | `turbo.json` の `build.outputs` を v2 の出力先に合わせる(D18) | 完了 | 2026-10-12: `outputs` を `.cloudflare/output/**` に変更。`vite build` / `cf build` の実出力は api・web とも `.cloudflare/output/v0/` のみ(`dist/` は作られず、残っているのは旧出力)。出力ディレクトリを消して `bun run build` を 2 回続けると、2 回目は両パッケージが `cache hit` で出力 10 ファイルを復元した。出力に `.dev.vars` は含まれない。`dist/**` を参照する他パッケージ・スクリプトは無く、`dist/**` は外した |
| 12 | 本番デプロイ(人間が承認して `cf deploy`) | 完了 | 2026-10-13: PR #21 のマージ後、ユーザーの承認(「main からデプロイして」)を受けて main(`38cd498`)からオーケストレーターが実行。事前に `bun install --frozen-lockfile`、両方の `cf build` と `cf deploy --dry-run` が成功(web 0.00 KiB、api 56.08 KiB、ともに `No bindings found.`)。api の本番バンドルは `/health` のみで、`openapi`・`localhost:3000`・`/users`・`/doc` を含まず、本番 web のオリジンを含む。両方の `worker.config.json` が `previewUrls:false`。web(`kin-niku-log`、Version `85cce261`)→ api(`kin-niku-log-api`、Version `fe716c66`)の順に `cf deploy`。web の公開 URL `https://kin-niku-log.aya-ayatsuki.workers.dev` は `PRODUCTION_WEB_ORIGIN` と一致 |
| 13 | デプロイ結果・費用上限の確認と記録 | 完了 | 2026-10-13: web の `/` は 200 でプレースホルダー(SPA の `index.html`)を返し、未定義のパスも 200(`single-page-application`)。api の `GET /health` は 200 `{"status":"ok"}`、`/users`・`/doc`・`/openapi.yaml` は 404(デプロイ直後の 1 回目だけ `/openapi.yaml` が 500 だったが、その後は繰り返し 404 で安定。反映途中の一時的な応答とみなす)。CORS は `Origin` が本番 web なら `access-control-allow-origin` が付き、`http://localhost:3000` や別オリジンには付かない。`cf workers secrets list` は両 Worker とも空(`DATABASE_URL` 未登録)。Version の Preview URL(`<version 先頭 8 桁>-<Worker 名>.aya-ayatsuki.workers.dev`)は両 Worker とも 404(`error code: 1042`)で発行されていない。費用: Workers Free(ユーザー確認済み、D3)で、上限超過時は Error 1027 で止まり課金されない。DB には接続していないため Neon 側の挙動は調査結果の記載にとどまる |
| 14 | D19: `docs/project-overview.md` の `/users` 確認済み記述に注記 | 完了 | 2026-10-12: 「確認済み」の直後に、#20 で `/users` のルート登録を外したこと(`sample-users-crud.md` 参照)を 1 行追記 |
| 15 | D20: web の dev サーバーのポート固定 | 完了 | 2026-10-12: `apps/web/vite.config.ts` に `server.strictPort: true`。ローカル動作確認で web は 3000 で起動 |
| 16 | web の `tsconfig.json` の `include` に `cloudflare.config.ts` を追加(コードレビュー F20) | 完了 | 2026-10-12: `tsc --listFilesOnly` で型チェック対象に入ることを確認、`check-types` 通過 |
| 17 | D21(README.md・`project-overview.md`。コードレビュー第 2 周 G1・G2・G7)と、`sample-users-crud.md` の修正(D14 の範囲。G3〜G5) | 完了 | 2026-10-13: web のデプロイ先を「Cloudflare Workers(静的アセット)」に置き換え(README 1 箇所、project-overview 2 箇所)、README の web `dev` の説明に workerd・ポート 3000 固定を追記、`GET /health` を README に追記、`sample-users-crud.md` の 3 箇所を修正。lint / check-types / build / `bun install --frozen-lockfile` 通過 |
| 18 | D23: 環境情報を `apps/api/src/config.ts` に切り出す(PR #21 のレビューコメント) | 完了 | 2026-10-13: `LOCAL_WEB_ORIGIN`・`PRODUCTION_WEB_ORIGIN`・`isDev`・`resolveAllowedOrigins`・`allowedOrigins` をコメントごと `config.ts` に移し、`isDev` と `allowedOrigins` だけを export。挙動の変更なし。lint / check-types / build 通過。本番バンドル(`bundle/index.js`)を再確認: `/health` のみ登録、`openapi`・`localhost:3000`・`/users`・`/doc` のルートなし、本番 web のオリジンあり |

## 構成(変更・追加の対象)

| 対象 | 変更 |
|---|---|
| `apps/api/src/index.ts` | `/users` 登録の削除、`/health` 追加、`/doc`・`/openapi.yaml` の本番無効化、CORS 設定の差し替え |
| `apps/api/src/config.ts`(新規) | `isDev`・ローカル/本番の web オリジンの定数・許可オリジン(`allowedOrigins`)を置く(D23)。`index.ts` は `isDev` と `allowedOrigins` を import して使う |
| `apps/api/cloudflare.config.ts` | プレビュー URL を無効にする(D15)。`DATABASE_URL` の `bindings.secret()` は宣言しない(D6) |
| `apps/api/package.json` | `@cloudflare/vite-plugin` を `2.0.0-beta.sha-91c870c02` に `^` なしで固定して更新(D16) |
| `apps/api/vite.config.ts` | v2 で `experimental.newConfig` が不要になり、`cloudflare()` のみにする |
| `apps/web/src/routes/index.tsx` | users 一覧画面をプレースホルダーに差し替え。API を呼ばない(D8) |
| `apps/web/cloudflare.config.ts`(新規) | 静的アセットだけの Worker `kin-niku-log`(D7)。プレビュー URL を無効にする(D15) |
| `apps/web/package.json` | D16 のプラグイン(固定版)と D17 の `cf` を devDependency に追加。スクリプトは変更なし |
| `apps/web/vite.config.ts` | `cloudflare()` を追加(D16)。`server.strictPort: true` でポート 3000 を固定(D20) |
| `apps/web/tsconfig.json` | `include` に `cloudflare.config.ts` を追加(型チェック対象にする、D17 の目的) |
| `apps/web/eslint.config.js` | `.cloudflare/**` を ignore に追加 |
| `bun.lock` | 上記の依存更新に伴う更新。lockfile の再解決により、D16・D17 の範囲を超える推移的な依存(`@img/sharp-*`・libvips・workerd など)も更新されている。lock は手編集しない |
| `turbo.json` | `build.outputs` を `.cloudflare/output/**` に変更(D18) |
| `README.md` | web のデプロイ先を Workers(静的アセット)に、web の `dev` の説明に workerd・ポート 3000 固定を、`GET /health` の説明を追記(D21) |
| `docs/project-overview.md` | 「`/users` が動作することは確認済み」に、#20 で登録を外した旨の 1 行を追記(D19)。web のデプロイ先(技術スタック表・CI/CD)を Workers(静的アセット)に置き換え(D21) |
| `docs/sample-users-crud.md` | 冒頭の注記(D14)と、#20 で事実と合わなくなる箇所の個別修正。内容は下記 |

`docs/sample-users-crud.md`(D14): 冒頭(タイトル直下)に注記を置く。内容は、画面と `/users` のルート登録を #20 で外したこと、サンプル一式は本番 users テーブルを作る issue で削除予定であること、コードは git の履歴で参照できること、#20 で変わった箇所は本文中で「(#20)」と明記して現状に合わせるという記述の基準。個別修正は次のとおり。「全体像」の図の画面の行に「(#20)」とプレースホルダーへの差し替えを明記。節 3 の `/users` の登録を外した旨と、Swagger UI は `/users` が表示されても呼ぶと 404 になる旨。本番で `/doc`・`/openapi.yaml` を登録しない理由は D9 の内容(サンプルの users API の構造を外に見せない)を説明的な文で書く。節 4 の参照先は `routes/index.tsx` ではなく git の履歴とし、「画面での使い方」は履歴上のコードの説明であることが分かる主語と時制にする。

`apps/api/src/crud/`、`routes/users.ts`、`db/schema/users.ts`、drizzle のマイグレーション、`seed.sample.ts`、`apps/web/src/generated/` は触らない(D11)。`docs/sample-users-crud.md` は削除せず、注記だけ加える(D11, D14)。

## 実装方針

### api

- **`/users` の登録削除**: `app.route('/users', users)` と `users` の import を外すだけにする。`routes/users.ts` などは残す(D11)。DB ミドルウェアは `/users` 配下にしか掛かっていないので、`/users` を外せば本番の api は DB に触れない
- **`GET /health`**: DB に触れない固定のレスポンスを返す(`{ status: 'ok' }`)。`openapi.yaml`(と orval の生成物)には載せない。理由: 生成物は触らない(D11)、本番ではスキーマを配信しない(D9)
- **`/doc`・`/openapi.yaml` の本番無効化(D9)**: 採用した方式は、登録を `isDev`(`import.meta.env.DEV`、Vite のビルド時定数)の条件に入れ、本番ビルドではルート自体を登録しないこと。ビルド時に分岐が除去されるので、本番バンドルに `openapi.yaml` の中身が残らない(実装状況 #4)。環境値による分岐は、ビルド時定数で足りたため採らなかった
- **CORS の環境切り替え(D10)**:
  - 採用した方式はビルド時定数。`isDev` ならローカルの `http://localhost:3000`、そうでなければコード内の定数 `PRODUCTION_WEB_ORIGIN`(本番 web の URL)だけを許可する。理由: web の URL が `aya-ayatsuki.workers.dev` の確認で確定しており、実行時に値を切り替える必要が無く、Worker の設定値や `Bindings` の型を増やさずに済む。`PRODUCTION_WEB_ORIGIN` のコメントには、web の Worker 名(`apps/web/cloudflare.config.ts` の name)と workers.dev サブドメインに依存するため、変えるときは許可オリジンも変える、という関係だけを残す
  - 捨てた案: Worker の非シークレット設定値(`bindings.json` など)で持つ案
  - ローカルの許可オリジンは完全一致なので、web の dev ポートは `strictPort: true` で 3000 に固定する(D20。別ポートに逃げるとブラウザからの呼び出しが CORS で拒否されるため)
  - `isDev` は「開発用ドキュメントの公開」と「CORS」を兼ねる。環境がローカルと本番の 2 つの間は分けない(F10 で見送り。staging を足すときに見直す)
- web の URL が確定済み(サブドメインは `aya-ayatsuki.workers.dev` と確認済み)なので、api のビルドを web のデプロイ後に回す必要は通常ない。デプロイ順は web → api のままとし、web の公開後に URL が `PRODUCTION_WEB_ORIGIN` と一致することを確認する
- **プレビュー URL の無効化(D15)**: `apps/api/cloudflare.config.ts` の `worker.previewUrls: false`
- `@cloudflare/vite-plugin` を v2 にしたことで、`vite.config.ts` の `newConfig` の指定は不要になった(`cloudflare()` のみ)

### web

- `/` を、Hello World 程度の静的なプレースホルダーに差し替える。`useQuery` など API 呼び出しを含めない(D8)。orval の生成物と `fetcher.ts` は残すが、プレースホルダーから参照しない
- 配信は、静的アセットだけの Worker `kin-niku-log`(エントリポイント無し)。`@cloudflare/vite-plugin`(v2、D16)で Build Output を作る構成で、クライアント出力は `.cloudflare/output/v0/workers/default/assets/` に出る。`apps/web/cloudflare.config.ts` には `name: "kin-niku-log"`、`compatibilityDate`(api と同じ `2026-09-27`)、SPA のフォールバック(`notFoundHandling: "single-page-application"`)、プレビュー URL の無効化(D15)を書く。アセットのディレクトリは書かない(プラグインが決める)。`run_worker_first` は使わない(Worker を通すと課金対象になるため)
- ローカル開発(`vite dev`)も、プラグインにより workerd 上で動く(D16 の影響)
- `apps/web/eslint.config.js` で `.cloudflare/**` を ignore する。理由: Build Output(バンドル済みの JS)を lint 対象にして失敗するため。api も同じ ignore を持つ
- 本番ビルドの `VITE_API_URL` は、プレースホルダーが API を呼ばないため初回は渡さない
- robots.txt は置かない(D4)。`apps/web/public` には無いことを確認済み

### デプロイ手順

1. 事前確認(下の「実装時に確認すること」)を完了する
2. web・api それぞれで `cf build` を実行し、Build Output(`.cloudflare/output/v0/`)が出ることを確認する(認証不要、Cloudflare の API は呼ばない)。あわせて api の本番バンドル(`apps/api/.cloudflare/output/v0/workers/default/bundle/index.js`)に、`/doc`・`/openapi.yaml` のルート(`openapi.yaml` の中身)と `localhost:3000` が含まれないことを確認する(本番ビルドが production モードであることの確認)
3. それぞれで `cf deploy --dry-run` を実行し、検証が通ることを確認する(API を呼ばない)
4. 人間が承認したうえで、web を `cf deploy` する(本番デプロイは人間が承認・実行する、project-overview の方針)。エージェントは本番への `cf deploy` を実行しない
5. web の公開 URL を確認し、`PRODUCTION_WEB_ORIGIN` と一致することを確認する。違っていた場合だけ、値を直してから api のビルドと `--dry-run` をやり直す
6. 人間が承認したうえで、api を `cf deploy` する。api の公開 URL は `kin-niku-log-api.aya-ayatsuki.workers.dev`
7. 確認項目: web の `/` がプレースホルダーを返す / api の `GET /health` が 200 / api の `/users`・`/doc`・`/openapi.yaml` が 404 / 許可オリジン以外の `Origin` に CORS ヘッダーが付かない / 本番 Worker に `DATABASE_URL` が登録されていない / 両 Worker にプレビュー URL が発行されていない(Version URL などが残るかもここで確認)
8. 完了条件の記録: Workers Free と Neon Free を使っており、Workers は上限超過時に Error 1027 で止まり課金されないこと(D3)を確認し、記録先は impl.md の実装状況(#13)の結果欄に、確認日と確認した事実を書く。design.md の決定事項には書かない(決定事項は現在有効な仕様の決定集として保つ)。本 issue では DB に接続しないため、Neon 側の挙動は調査結果の記載にとどまる

### 検証

このプロジェクトにはテスト(テストスクリプト・テストファイル)が整備されていない。テストが無いため、機械的検証は lint / check-types / build のみとし、実行時整合の検証(テスト実行)は省略する(黙ってスキップするのではなく、ここに明記する)。代わりにデプロイ前後の動作確認(デプロイ手順 2・3・7)で補う。

### コミット分割案

意味単位で 1 コミットずつ(commit-workflow に従う)。途中のコミットでビルド・lint が壊れないよう、次の順で切る。

1. 依存更新(D16・D17・D18): 両 `package.json`、`bun.lock`、api の `vite.config.ts`(v2 で `newConfig` が不要になった変更。プラグイン更新と不可分)、`turbo.json`(`build.outputs`)
2. web の Worker 設定: web の `vite.config.ts` への `cloudflare()` 組み込み、`apps/web/cloudflare.config.ts`(`previewUrls: false` を含む)、`apps/web/eslint.config.js` の `.cloudflare/**` ignore、web の `tsconfig.json`(`cloudflare.config.ts` を型チェック対象に)
3. api のルート整理(`/users` 登録の削除・`/health` 追加・`/doc` と `/openapi.yaml` の本番無効化)。`isDev` の定義はここに含める
4. api のプレビュー URL の無効化(`apps/api/cloudflare.config.ts` のみ)
5. CORS: api の CORS(`index.ts` の許可オリジン部分)と、web の `vite.config.ts` の `strictPort`(D20)
6. web のプレースホルダー(`routes/index.tsx`)
7. docs の注記・修正(`README.md`、`docs/sample-users-crud.md`、`docs/project-overview.md`)
8. design.md・impl.md(`docs/issues/20-initial-deploy/`)

同じファイルが複数のコミットにまたがる箇所は、ハンクごとに分けて stage する(`git add -p`)。web の `vite.config.ts` は 2(`cloudflare()`)と 5(`strictPort`)、api の `index.ts` は 3(ルート整理と `isDev`)と 5(許可オリジンの定数・`cors({ origin })`)にまたがる。web の `vite.config.ts` のハンクが分けられない場合は、`vite.config.ts` の変更全体を 5 にまとめる(2 の時点では `cloudflare()` が未組み込みになるが、ビルド・lint は壊れない)。api の `index.ts` が分けられない場合は 3 と 5 を 1 コミットにまとめる。

## 実装時に確認すること

確認事項 1〜3・5・6 と、7 のうち `previewUrls` の反映は「実装時に確認できたこと」に記録済み。残っているのは次の 2 点だけ。

- 確認事項 4(任意): `cf` 1.0.0-beta.12 に、既存シークレットが落ちる不具合(cloudflare/cf #70)の修正が入っているか。分かった場合だけ記録する。初回は `DATABASE_URL` を登録しないので影響は小さく、シークレットを扱うのは DB をつなぐ issue
- 確認事項 7 の残り: `previewUrls` を無効にしても Version / Preview / Deployment URL が残らないか。`cf deploy` しないと確認できないため、デプロイ手順 7 で確認し、残る場合は記録する

## 既知の制約

- ヘルスチェックと(将来の)Worker を通るリクエストは、Workers Free の 1 日 100,000 件に数えられる。超えると Error 1027 で止まる(D3, D4 で受け入れ済み)
- CORS はブラウザにしか効かない。curl やクローラーの `/health` へのアクセスは防げない
- `@cloudflare/vite-plugin` は beta の固定版(D16)。更新は明示的に行う
- `cf build` 中に `Cannot connect to the Docker daemon` と表示されるが、ビルドは成功する(原因は未調査、Docker は未使用)
- 依存更新(lockfile 変更)後の初回 `bun run dev` は、依存の再最適化のため web への最初のリクエストが 2 分近く応答しない(2 回目以降は即応答)

## 未解決の疑問

なし(Q1 は D14 で決定)。

## レビュー指摘と対応

### ドキュメントレビュー 1 回目(2026-10-12、9 件)

- 出所: docs / 状態: 対応済み(前任のドキュメントエージェントの修正で対応。個別の指摘内容は引き継ぎ時に記録されておらず、ここには件数のみ残す)

### ドキュメントレビュー 2 回目(2026-10-12、5 件)

1. D14 の注記の範囲が節 4 の参照記述に限られ、節 3 の `/users` 登録の記述(131 行付近)と Swagger UI の「全エンドポイントを確認・試打できる」(135 行付近)も事実と合わなくなる点が漏れていた
   - 出所: docs / 状態: 対応済み / 対応: 構成表の行・注記の内容・実装状況 #9 に 3 箇所を個別修正の対象として明記し、冒頭の注記も置く
2. api の許可オリジンをビルド時に埋め込む場合、api のビルド・`--dry-run` を許可オリジン確定前に行う手順になっていた
   - 出所: docs / 状態: 対応済み / 対応: デプロイ手順に順序を明記(その後サブドメイン確定により、通常は分岐が発生しない形に整理済み)
3. 確認事項 7(`/health` を openapi.yaml に載せるか)は決定済みの方針で、確認事項にする必要がない
   - 出所: docs / 状態: 対応済み / 対応: 理由(D11・D9)を `GET /health` の実装方針に移し、確認事項 7 を削除。旧 8 を 7 に繰り上げ、参照も直した
4. 完了条件(費用上限の確認)の結果の記録先が曖昧だった
   - 出所: docs / 状態: 対応済み / 対応: 手順 8 の記録先を impl.md の実装状況の結果欄(確認日と確認した事実)と明記し、結果欄を表に追加。design.md の決定事項には書かない
5. コミット分割案が無い
   - 出所: docs / 状態: 対応済み / 対応: 「コミット分割案」を追記(あわせてテスト省略の明記を「検証」に追加)

### レビュー第 1 周(2026-10-12、12 件)

すべて 出所: docs(3a 由来、3a-fix で即修正済み) / 状態: 対応済み。

1. 冒頭の出典が D1〜D15・状態が「実装未着手」のまま → 「D1〜D18」「実装第 1 周済み(本番デプロイ前)」に置き換え
2. 実装状況 #1 が確認事項 1・2 を未解決のまま記載 → D16・D17 で対応済み、残りは確認事項 4 と Version URL だけと置き換え
3. 実装状況 #10 の web が D17 前の失敗の記述のまま → D17 実施後の結果(`cf build` 成功、`--dry-run` は 0.00 KiB・`No bindings found.`)に置き換え
4. 実装状況 #4・#6 と確認結果が v1 時代の根拠(`dist/...`、`wrangler.json`)のまま → v2 の出力(`.cloudflare/output/v0/workers/default/`)に置き換え。D9 の検証結果は v2 の `bundle/index.js` での確認事実で記録
5. 構成表に第 1 周で変更したファイル(`apps/api/package.json`・両 `vite.config.ts`・`apps/web/eslint.config.js`・`bun.lock`)と `turbo.json`(D18)が無い → 追加
6. 構成表の `types.ts` 行が不要、api `cloudflare.config.ts` に不要な条件記述、`apps/web/package.json` の行が確認待ちのまま → 削除・置き換え
7. 実装方針「api」が決定前の選択肢・条件付きの書き方のまま → 採用した方式(ビルド時定数)と理由に置き換え、捨てた案は 1 行に縮約。サブドメインを確認済みの記述に、プラグイン v2 で `newConfig` 不要の旨を追加
8. 実装方針「web」が「`cloudflare.config.ts` にアセットのディレクトリを書く」前提のまま → プラグインによる Build Output 構成に書き換え。ローカル開発が workerd 上で動く点と `.cloudflare/**` の eslint ignore の理由を追加
9. 「実装時に確認すること」1・2 と「確認できたこと」1・2 が古く、後段の D16・D17 の段落と重複 → 解決済みの事実に置き換えて統合
10. ローカル動作確認が 3 回分重複し、古い段落(web 未確認の記述)が残っていた → 最新の結果 1 本に統合、コマンドやログの書き写しは要点に縮約
11. コミット分割案に依存更新(D16・D17)のコミットが無く、プレビュー URL のコミットが両 Worker にまたがっていた → 依存更新のコミットを追加(D18 の `turbo.json` も同コミット)、プレビュー URL のコミットは api のみに限定、web の `previewUrls` は web の Worker 設定のコミットに含める
12. `turbo.json` の `build.outputs` のずれが既知の制約扱いだった → 対応済み(D18 として第 2 周で実装、実装状況 #11)

### レビュー第 2 周 ドキュメント(2026-10-12、5 件)

すべて 出所: docs(3a 由来、3a-fix で即修正済み) / 状態: 対応済み。

1. 第 1 周 #12 の状態が「第 2 周で実装」のままで、実装済みの現状と合わない → 「対応済み(D18 として第 2 周で実装、実装状況 #11)」に置き換え、前書きの例外の扱いを削除
2. 実装方針「api」の CORS の項が、採用案・捨てた案・コメントの内容が混在していた → 採用した方式と理由、捨てた案 1 行、D20、`isDev` 兼用の見送りの順に整理。コードの書き写しに近いコメントの記述は依存関係だけに縮約
3. コミット分割案で、途中のコミットのビルド・lint が壊れる分け方になっていた(web の `cloudflare()` と設定ファイルが別コミット、プラグイン更新と api の `vite.config.ts` が別コミットなど) → 依存更新 / web の Worker 設定 / CORS に分け直し、同一ファイルをまたぐ stage の注意を明記
4. 構成表の下の `docs/sample-users-crud.md` の段落が、行番号を含む細かい記述だった → 何をどう直したかの要点に縮約し、行番号を削除
5. 「実装時に確認すること」の前書きが、確認事項 4 と 7 の残りだけを書いていて、記録済みの範囲が分かりにくかった → 「確認事項 1〜3・5・6 と、7 のうち `previewUrls` の反映は記録済み」と書き換え

### レビュー第 1 周 コード(2026-10-12)

出所: code(3b 由来)。採点で閾値(75)未満として除外した 12 件と、証拠により除外した 7 件は、件数のみ記録する。

1. F1(75): `docs/project-overview.md` に「`bun dev` で `/users` が動作することは確認済み」が残る
   - 状態: 対応済み / 対応: D19 で 1 行追記(ユーザー決定)
2. F2(75): `bun.lock` に D16・D17 の範囲を超える推移的な依存の更新が含まれる
   - 状態: 対応済み / 対応: lockfile 再解決による副作用として構成表の `bun.lock` の行に記録。lock は手編集しない
3. F6(75): `/doc`・`/openapi.yaml` が本番に出ないことは、デプロイ用ビルドが production モードであることが前提
   - 状態: 対応済み / 対応: デプロイ手順 2 に、本番バンドルの確認を追加。2026-10-12 に api の `cf build` 後のバンドルで確認(`/doc`・`openapi.yaml`・`localhost:3000` なし、`/health` のみ。`@hono/swagger-ui` の import 由来の定数だけ残る)
4. F9(75): `PRODUCTION_WEB_ORIGIN` のコメントが日付付きの作業ログで、依存関係が書かれていない
   - 状態: 対応済み / 対応: 依存関係(web の Worker 名・workers.dev サブドメインと、変更時に許可オリジンも変える必要)の説明に置き換え
5. F10(75): `isDev` が「開発用ドキュメントの公開」と「CORS」の 2 用途を兼ねる
   - 状態: 対応見送り / 理由: design.md の環境はローカルと本番の 2 つだけで、分ける必要が生じたとき(staging 追加など)に対応すればよい
6. F16(75): `docs/sample-users-crud.md` で冒頭の注記と本文の記述の基準が混在し、「(#20 の D9)」が説明の無い内部参照
   - 状態: 対応済み / 対応: 冒頭の注記に「#20 で変わった箇所は本文中で『(#20)』と明記し現状に合わせている」と基準を明記。D9 は「本番では `/doc` を公開しないため」の説明文と design.md のパスに置き換え
7. F18(75): ローカルの CORS が `http://localhost:3000` 完全一致のみで、Vite が別ポートで起動すると拒否される
   - 状態: 対応済み / 対応: D20 で web の `vite.config.ts` に `strictPort: true`
8. F20(80): web の `tsconfig.json` の `include` に `cloudflare.config.ts` が無く型チェック対象外
   - 状態: 対応済み / 対応: `include` に追加。`tsc --listFilesOnly` で対象入りを確認、`check-types` 通過

### レビュー第 2 周 コード(2026-10-13)

出所: code(3b 由来)。42 件のうち 35 件は証拠・決定事項・第 1 周の採点結果の繰り返しなどで除外した。G6(55 点: 追加手順の `app.route()` の扱い)は閾値未満で除外した。採点エージェントが一度すべて応答停止で失敗したため、再実行した。

1. G1(75): web のデプロイ先が「Cloudflare Pages」のまま(README、project-overview の技術スタック表と CI/CD)
   - 状態: 対応済み / 対応: D21(ユーザー決定)。3 箇所とも「Cloudflare Workers(静的アセット)」に置き換え
2. G2(75): README の web の `bun run dev` の説明に、workerd 上で動くこと(D16)とポート 3000 固定・使用中ならエラー(D20)が無い
   - 状態: 対応済み / 対応: D21 で追記
3. G3(75): `sample-users-crud.md` の「全体像」の図の画面の行に「(#20)」の明記が無い
   - 状態: 対応済み / 対応: 図の該当行に「(#20)」とプレースホルダーに差し替えた旨を追記
4. G4(75): `sample-users-crud.md` の本番で登録しない理由が D9 の理由と一致しない
   - 状態: 対応済み / 対応: 「サンプルの users API の構造を外に見せないため」(`/doc`・`/openapi.yaml` 両方)に置き換え
5. G5(75): 「画面での使い方」の閉じ括弧が対応せず、「createRoute で定義し」の主語が曖昧
   - 状態: 対応済み / 対応: 括弧を直し、「その画面は〜登録されていた」と履歴上のコードの説明にした
6. G7(75): `GET /health` が README・docs のどこにも書かれていない
   - 状態: 対応済み / 対応: D21 で README の URL 一覧(バックエンド)に、DB に触れない疎通確認用で `openapi.yaml` には載せない旨を追記

### レビュー第 3 周 ドキュメント(2026-10-13、4 件)

出所はすべて docs(3a 由来、3a-fix でオーケストレーターが即修正済み)。

1. 実装状況 #9 の結果欄に「全体像の図は個別には直していない」という古い記述が残っていた
   - 状態: 対応済み / 対応: 第 2 周 G3〜G5 で修正した旨に置き換えた
2. コミット分割案に `README.md`(D21)が割り当てられていなかった
   - 状態: 対応済み / 対応: 7 の対象に `README.md` を加えた
3. 実装状況 #17 の項目名で、`sample-users-crud.md` の修正まで D21 の範囲に読めた
   - 状態: 対応済み / 対応: D21(README・project-overview)と D14 の範囲の修正(G3〜G5)に出典を分けた
4. 構成表と下の段落に「第 3 周の追加修正」という周回の経緯が追記の形で残っていた
   - 状態: 対応済み / 対応: 現在の修正内容の一覧に統合し、周回の経緯はレビュー記録に任せた

### レビュー第 3 周 コード(2026-10-13)

出所: code(3b 由来。変更がドキュメントのみのため 1 レンズの簡易レビュー)。5 件のうち H2・H3・H5(50 点)と H4(25 点)は閾値未満で除外した。

1. H1(75): `sample-users-crud.md` の「画面での使い方」で、外す前の画面の説明(過去形)の直後に「API の呼び出しは `fetcher.ts` が担い」(現在形)が続き、今もプレースホルダーが API を呼んでいるように読める
   - 状態: 対応済み / 対応: 3 周の上限に達したため design.md の Q2 でエスカレーションし、D22(H1 だけを直す延長を 1 回)で対応。「当時の画面は `fetcher.ts` 経由で API を呼んでいた」「`fetcher.ts` 自体は今も残っているが、現在の `/` からは呼ばれていない」の 2 文に書き換えた

### 延長(D22)の簡易レビュー(2026-10-13)

出所: code(1 レンズの簡易レビュー)。H1 は解消、事実関係(現在の `index.tsx`・`router.tsx`・`fetcher.ts` の接続先、#20 より前の `index.tsx`)にも誤りなし。指摘 1 件(I1: 最終行「接続先は〜」の主語が省略されている)は採点 50 で閾値未満のため除外した。採点 75 以上の指摘は 0 件。lint / check-types / build 通過。

### PR #21 のレビュー(2026-10-13、ユーザー)

出所: ユーザーの GitHub レビュー。

1. `apps/api/src/index.ts` の `PRODUCTION_WEB_ORIGIN` などの環境情報は `config.ts` のようなファイルにまとめる(将来は環境変数にするかも)
2. `resolveAllowedOrigins` などはアプリ全般の設定として、どこからでも参照してよい層に置く
   - 1・2 の状態: 対応済み / 対応: 置き場所を design.md の Q3 でエスカレーションし、D23(`apps/api/src/config.ts` を新設、ビルド時定数のまま)で対応(実装状況 #18)。コードの移動のみで挙動は変えていないため、オーケストレーターが差分(定義の移動と import の追加のみ)と本番バンドルの再確認で検証した
3. `docs/` の記述を GitHub(公開リポジトリ)に公開して問題ないか確認する
   - 状態: 確認済み・変更なし / 結果: docs 4 ファイルと docs の過去コミットに、秘密情報(トークン・接続文字列・秘密鍵)、アカウント ID・Neon の ID やホスト名、ローカルの絶対パスは無い。本番 URL はコードにも同じ値があり、費用・クロール対策の記述は公開の料金体系から推測できる範囲で、止まるのは `/health` だけのため、現段階では伏せない。DB を使う機能を公開するときに再判断する

## 実装時に確認できたこと(2026-10-12)

確認事項の番号に対応する。

1. api: `@cloudflare/vite-plugin` 1.62.5 のままでは `cf build` が失敗する(cf のローカルランタイムと非互換、v2 beta が必要)。`cfBuildOutput: true` の追加では足りず、D16 で v2 beta に更新して解決した。v2 では `vite build` / `cf build` の出力は `.cloudflare/output/v0/` で、`dist/` は作られない。出力(`config.json`、`workers/default/worker.config.json`、`bundle/index.js`、`bundle/.vite/manifest.json`)に `.dev.vars` は無く、`worker.config.json` にも bindings / vars は無い。`cf deploy --dry-run` は認証・API 呼び出し無しで通り、`No bindings found.` と表示された。よって D6 のとおり、デプロイでシークレット / 変数はアップロードされない。なお `apps/api/dist/` に残る `.dev.vars` は v1 時代の古い出力で、gitignore 済み・デプロイ対象外(値は確認していない)
2. web: v2 のプラグインを入れ(D16)、`cf` を追加(D17)して解決した。`cf build` 成功で、`cloudflare.config.ts` にアセットのディレクトリ指定は不要(プラグインが `vite build` のクライアント出力を使う)。Build Output は `config.json`、`workers/default/worker.config.json`、`workers/default/assets/`(`index.html`・`favicon.ico`・`assets/index-*.css`・`assets/index-*.js`)のみで、Worker スクリプト(`bundle/`)は含まれない。`worker.config.json` は name `kin-niku-log`・compatibilityDate・`assets.notFoundHandling: "single-page-application"`・`previewUrls:false` のみ。`cf deploy --dry-run` は認証・API 呼び出し無しで成功(`Read 5 files from the assets directory`、Total Upload 0.00 KiB、`No bindings found.`)。`bun.lock` 上 api・web とも `cf@1.0.0-beta.12`
3. `worker.assets` の項目は `htmlHandling` / `notFoundHandling`(`"single-page-application" | "404-page" | "none"`) / `runWorkerFirst`。`entrypoint` は省略可
4. 未確認(`DATABASE_URL` を扱わないため)
5. 非シークレットの設定値は `bindings.json(...)` / `bindings.text(...)` で宣言できることを型定義で確認した(`@cloudflare/config` 0.23.0)。今回はビルド時定数方式を選んだので使っていない
6. `isDev` 経由の分岐で、本番ビルドから `/doc`・`/openapi.yaml` のコードと `openapi.yaml` の中身が消えることを確認した(実装状況 #4)。lint の `turbo/no-undeclared-env-vars` が `import.meta.env.DEV` を環境変数と誤検知するため、1 箇所だけ `eslint-disable-next-line` を付けた
7. サブドメインは `aya-ayatsuki.workers.dev`(ユーザーがダッシュボードで確認)。`previewUrls: false` は両 Worker の `worker.config.json` に反映される。`workers.dev` は有効のまま。Version URL などが残るかは `cf deploy` を行わないと確認できず未確認

機械的検証(lint / check-types / build / `bun install --frozen-lockfile`)はすべて通過。ローカル動作確認(`bun run dev --ui=stream`、D17 実施後): `http://localhost:3000/` 200、`/does-not-exist` 200(index.html を返す SPA フォールバック)、`http://localhost:8080/health` 200、`/users` 404、`/doc` 200、`/openapi.yaml` 200。CORS は `Origin: http://localhost:3000` のみ `access-control-allow-origin` 付き、`http://evil.example` には無し。確認後 dev は停止し、vite / workerd / turbo の残りが無いことを確認した。
