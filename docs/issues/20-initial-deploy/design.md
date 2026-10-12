# #20 機能実装前に本番環境へ初回デプロイ(クロール・高額請求対策込み) — design.md

- issue: https://github.com/ayatsuki-meowmeow/kin-niku-log/issues/20
- 状態: 2026-10-12 に論点 U1〜U8 と Q1 をユーザーが決定し、決定事項(D1〜D21)に転記済み。2026-10-13 に Q2 をユーザーが決定し D22 に転記済み。未決事項なし
- 調査結果は 2026-10-05 時点の記録。仕様の決定はユーザーが行う

---

## 目的・背景

- 機能実装の前に、web と api を本番環境(Cloudflare + Neon)へ一度デプロイし、デプロイ経路が通ることを確認する。機能実装と初回デプロイを同時に行うと、失敗したときに「デプロイ設定の問題」か「機能の問題」かを切り分けにくいため、経路だけを先に通す
- ユーザー要望(2026-10-05)
  - **AI サービスなどのクロールによる高額請求への対策は必須**
  - 現在のトップページ(`/` の users 一覧)はアクセスのたびに API → DB へのアクセスが発生するため、**そのまま公開しない**
- 範囲: 手動での初回デプロイまで。GitHub Actions からの自動デプロイ(CD)は別 issue

### 完了条件(issue より)

- web と api が本番環境にデプロイされ、決めた公開範囲どおりにアクセスできる
- 想定外のアクセスが来ても費用が上限を超えない(または請求が発生しない)構成であることを確認し、記録してある

### 経緯(関連 issue の決定・申し送り)

| issue | 内容 |
|---|---|
| #2 | Workers(API)のプロジェクト名は `kin-niku-log-api`、Pages(Web)は `kin-niku-log`。Pages は **Git 連携ではなく Direct Upload** で作る想定(作成方法は後から変えられない) |
| #15 | Cloudflare CLI を wrangler から `cf`(open beta)へ移行。apps/api は Vite + `@cloudflare/vite-plugin` でビルドし、デプロイは Phase 2 で `cf deploy` を使う想定 |
| #1 | Neon プロジェクト `kin-niku-log`、リージョンは AWS Singapore(`aws-ap-southeast-1`)。開発用ブランチは作らず、`production` ブランチを開発にも使う。「公開前に、データを空にするか開発用ブランチを切るかを判断する」とされている |
| `docs/project-overview.md` | 本番デプロイコマンド(`cf deploy` など)は hooks で検知し、明示フラグが無ければブロックする方針。本番デプロイは人間が承認する(Human on the loop) |

### 実装の現状(2026-10-05 時点、main)

| 対象 | 現状 | デプロイに関係する点 |
|---|---|---|
| `apps/api/cloudflare.config.ts` | `name: "kin-niku-log-api"`、`compatibilityDate: "2026-09-27"`、`nodejs_compat`、`entrypoint: "src/index.ts"`。シークレットの宣言なし、assets なし、`workersDev` / `previewUrls` の指定なし | 本番シークレットの宣言方法、workers.dev / プレビュー URL の扱いが未設定 |
| `apps/api/vite.config.ts` | `cloudflare({ experimental: { newConfig: true } })`。`cfBuildOutput` は未指定 | `cf deploy` が読むビルド出力(`.cloudflare/output/v0/`)が出るかどうかに関係(後述) |
| `apps/api/src/index.ts` | `app.use(cors())`(オリジン全許可)。`/openapi.yaml`、`/doc`(Swagger UI)、`/users` を公開 | ヘルスチェック用のルートは無い。`/users` には認証が無く、POST / DELETE も誰でも呼べる |
| `apps/api/src/middleware/db.ts` | リクエストごとに `c.env.DATABASE_URL` から接続を作る(`/users` 配下だけに適用) | `/openapi.yaml` と `/doc` は DB に触れない |
| `apps/web` | Vite SPA。`/` が users 一覧(読み込み時に `GET /users`、追加・削除フォームあり)。`src/lib/fetcher.ts` は `VITE_API_URL`(未設定なら `http://localhost:8080`)を使う | 本番ビルドでは `VITE_API_URL` をビルド時に渡す必要がある。今のまま公開すると誰でも DB の読み書きができる |
| 依存バージョン | `cf` 1.0.0-beta.12、`@cloudflare/vite-plugin` 1.62.5 | 後述の「cf CLI」の確認事項に関係 |

---

## 調査結果(公式ドキュメント、2026-10-05 確認)

確認できなかったことは「未確認」と書いている。推測で補った箇所は「推定」と書いている。

### 1. Cloudflare Workers の料金・上限

| 項目 | Free | Paid |
|---|---|---|
| 月額 | 0 | 最低 $5/月(アカウント単位) |
| リクエスト | 1 日 100,000 件(UTC 0 時にリセット) | 月 1,000 万件込み、超過分 $0.30 / 100 万件 |
| CPU 時間 | 1 リクエストあたり 10 ms | 月 3,000 万 CPU ms 込み、超過分 $0.02 / 100 万 CPU ms。1 リクエストあたり最大 5 分(既定 30 秒) |
| サブリクエスト | 1 リクエストあたり 50 | 1 リクエストあたり 10,000 |

- **Free の上限を超えたとき**: 「その種類の処理はエラーで失敗する」。課金は発生しない。1 日のリクエスト上限を超えると **Error 1027** を返す。ルート経由の場合は fail open(Worker を飛ばす)/ fail closed(エラーページ)を選べる
- **Paid には支出の上限(キャップ)を設定する機能が無い**(料金ページに記載なし)。Budget alerts(使用量課金がしきい値を超えたらメール通知)はあるが、「情報提供のみで、使用量を止めたり上限を設けたりはしない」と明記されている。Pay-as-you-go アカウントでは既定で $10 のアラートが作られる
- **静的アセット**: 「静的アセットへのリクエストは無料・無制限」「アセットの保存に追加費用はかからない」。課金・カウントされるのは Worker スクリプトが呼ばれたリクエストだけ
  - SPA 設定(`not_found_handling: "single-page-application"`)では、compatibility date が 2025-04-01 以降ならブラウザのナビゲーションリクエスト(`Sec-Fetch-Mode: navigate`)は Worker を呼ばずにアセットとして返る(= 無料)。本プロジェクトの compatibility date は 2026-09-27 なので該当する
  - `run_worker_first` で Worker を先に通すパスは課金対象になる。Free で上限を超えると、そのパスはアセット配信にフォールバックせず 429 になる
- 静的アセットの上限: 1 バージョンあたり 20,000 ファイル(Free)/ 100,000(Paid)、1 ファイル 25 MiB
- `workers.dev` について: 「`workers.dev` サブドメインは Free のウェブサイトとして扱われ、ビジネスクリティカルでない個人・趣味のプロジェクト向け」。本番運用には独自ドメイン(ルート / カスタムドメイン)が推奨されている

出典:
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://developers.cloudflare.com/workers/configuration/routing/
- https://developers.cloudflare.com/billing/manage/budget-alerts/

### 2. Cloudflare Pages と Workers 静的アセット

- Pages の Free 上限: ビルド 500 回/月、1 サイト 20,000 ファイル、1 ファイル 25 MiB、カスタムドメイン 100、プロジェクト 100/アカウント
- Pages の静的リクエスト: 「Free・Paid ともに静的アセットへのリクエストは無料・無制限。Functions を呼ばないリクエストを静的とみなす」。Pages Functions は Workers のリクエストとして数えられる(Free では Workers と合わせて 1 日 100,000 件)
- **現在の推奨**: Pages のトップページに「Workers は Pages のほとんどのユースケースをサポートし、より広い機能を持つ。Cloudflare のアプリケーション構築の主要プラットフォームである。**新規プロジェクトは Workers で始めること**」と明記されている
- Workers にしかない機能(Pages からの移行ガイドの比較表より): Workers Logs などの Observability、Rate Limiting バインディング、Cron Triggers、Vite プラグイン、Gradual Deployments など
- Pages のプロダクション URL(`*.pages.dev`)に Cloudflare Access をかけるには手順が必要。Pages 設定の「Enable access policy」はプレビューデプロイしか守らず、`*.pages.dev` 本体を守るには Known issues の回避手順(Access アプリのサブドメインのワイルドカードを外す等)を踏む
- **`cf` CLI での Pages デプロイ**: `cf` の「Wrangler から cf への対応表」に Pages(Direct Upload / プロジェクト作成)の記載が無い。`cf` で Pages へデプロイできるかは**未確認**

出典:
- https://developers.cloudflare.com/pages/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- https://developers.cloudflare.com/pages/configuration/preview-deployments/
- https://developers.cloudflare.com/pages/platform/known-issues/
- https://developers.cloudflare.com/cf/wrangler/reference/

### 3. Neon Free プラン

| 項目 | Free |
|---|---|
| 月額 | $0 |
| コンピュート | 100 CU-hours / プロジェクト / 月。プロジェクト内の全コンピュート(全ブランチ)の合計で数える |
| ストレージ | 1 GB / プロジェクト(アカウント合計 20 GB) |
| プロジェクト数 | 100 |
| ブランチ | 10 / プロジェクト(追加不可) |
| オートスケール | 最大 2 CU(8 GB RAM) |
| Scale to zero | 5 分間アイドルで停止(無効化不可) |
| 外向き転送量 | 5 GB / プロジェクト / 月 |
| 履歴(リストア) | 6 時間(最大 1 GB-month) |

- **上限を超えたとき**: CU-hours か転送量を使い切ると「次の請求期間まで、またはアップグレードするまでコンピュートが停止する」。ストレージが 1 GB を超えると、容量を増やす操作(insert / update / delete)が失敗する。Free は上限超過でも $0
- **含意(推定)**: CU-hours はプロジェクト単位なので、本番 Worker と開発が同じ Neon プロジェクトを使う場合、本番への大量アクセスでコンピュートが起き続けると **開発用の DB も一緒に止まる**。例えば 0.25 CU のコンピュートが 1 か月起き続けると約 182 CU-hours(0.25 × 730 時間)で上限を超える(最小サイズが 0.25 CU であることは未確認)
- Free プランの登録にクレジットカードが必要かは**未確認**(既にアカウント作成済みなので本 issue への影響は小さい)

出典:
- https://neon.com/docs/introduction/plans

### 4. クロール・不正アクセス対策の手段

前提: 本プロジェクトは独自ドメインを持たず、`*.workers.dev` / `*.pages.dev` を使う想定。

| 手段 | Free で使えるか | `workers.dev` / `pages.dev` で使えるか | Worker のリクエスト数を減らせるか | 備考 |
|---|---|---|---|---|
| Cloudflare Access(Zero Trust) | 使える。Zero Trust Free は 50 ユーザーまで無料(Cloudflare のブログ・製品ページの記載。開発者ドキュメントでは未確認) | **使える(確認済み)**。Worker の「Access」タブで「Protect this Worker behind Access」を選ぶと `workers.dev` を含む Worker 全体を守れる。Pages は前述の回避手順が必要 | **減らせる**。「すべてのリクエストは Worker が動く前にチェックされる」 | Zero Trust の有効化が前提。**Free プランでも支払い情報の登録が必要**(「Free を選んでもこの手順は必要だが課金されない」)。Worker 側は `ctx.access` で認証済みユーザーを取れる |
| AI ボットのブロック(Block AI bots / AI Crawl Control) | 全プランで使える | **未確認**。ダッシュボードのドメイン(ゾーン)単位の Security Settings で設定するため、独自ドメインが必要と推定 | — | — |
| Bot Fight Mode | Free で使える | **未確認**。ゾーン単位の設定のため、独自ドメインが必要と推定 | — | WAF のルールでスキップできない。API やモバイルアプリの通信にもチャレンジを出すことがある |
| WAF レート制限ルール | Free は 1 ルール、期間 10 秒、IP 単位のみ | **未確認**。ゾーン単位の設定のため、独自ドメインが必要と推定 | 未確認(ブロックされたリクエストが Worker を呼ぶか・課金されるかはドキュメントに記載なし) | — |
| Workers の Rate Limiting バインディング | 料金・Free での可否はドキュメントに記載なし(**未確認**) | Worker のコード内で使うので URL に依存しない | **減らせない**。判定するには Worker が動くので、リクエスト数・CPU 時間は消費する。DB へのアクセスは防げる | 期間は 10 秒か 60 秒。ロケーションごとに数える結果整合で、厳密な計数には使えない。キーに IP を使うのは非推奨 |
| robots.txt | 静的アセットとして置けば無料 | 置ける | 減らせない | 「robots.txt に従うかはクローラー次第で、技術的にアクセスを防ぐものではない」。Cloudflare の managed robots.txt はゾーン単位の機能 |
| workers.dev / プレビュー URL の無効化 | — | `cloudflare.config.ts` の `workersDev` / `previewUrls` で切り替えられる | — | `workers.dev` を無効にしても Version / Preview / Deployment URL は無効にならない。独自ドメインが無い場合、`workers.dev` を無効にすると到達手段が無くなる |

Access と CORS の関係:
- Access で守った API に別ホストの web から `fetch` する場合、リクエストに `CF_Authorization` Cookie が必要。プリフライト(OPTIONS)には Cookie が付かないため、「OPTIONS をオリジンに素通しする」などの設定が要る
- 2 つの Access 保護ホスト間の呼び出しには、Worker からサービストークンを付ける方法が案内されている
- web(`*.pages.dev` または `*.workers.dev`)と api(`*.workers.dev`)が別サイト扱いになる場合、API の Cookie はサードパーティ Cookie になり、ブラウザ設定によってはブロックされる。`workers.dev` / `pages.dev` が Public Suffix List に入っていて別サイト扱いになるかは**未確認**

出典:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/learning-paths/replace-vpn/get-started/create-zero-trust-org/
- https://blog.cloudflare.com/teams-plans/(Zero Trust Free 50 ユーザー)
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/
- https://developers.cloudflare.com/ai-crawl-control/
- https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/
- https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
- https://developers.cloudflare.com/bots/get-started/bot-fight-mode/
- https://developers.cloudflare.com/waf/rate-limiting-rules/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

### 5. `cf` CLI でのデプロイとシークレット

デプロイ:
- `cf build`: プロジェクトをビルドし `.cloudflare/output/v0/` に Build Output を書く。アップロードはしない。認証不要
- `cf deploy`: ビルド → Build Output の検証 → 認証情報とアカウントの解決 → Worker Version のアップロード → デプロイ。主なオプションは `--dry-run`(API を呼ばずに検証)、`--prebuilt`(既存の Build Output を使う)、`--mode`、`--message` / `--tag`、`--secrets-file`
- `--prebuilt` のとき、Build Output に記録された mode と同じ `--mode` を渡す必要がある(Vite は常に mode を記録し、既定は `production`)
- CI では `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を使う(CD は別 issue)

`@cloudflare/vite-plugin` と `cfBuildOutput`:
- プラグイン 1.62.5 の型定義では `experimental.newConfig.cfBuildOutput` は「新しい `cf` CLI が読む実験的な Build Output(`.cloudflare/output/v0/`)を出力するかどうか」
- `cf` のドキュメントは「`cf` は Cloudflare Vite plugin 2.0 beta(`@cloudflare/vite-plugin@beta`)を使う」としている。2.0 beta の `cf-vite build` は `newConfig` と `cfBuildOutput` を強制的に有効にする、という記述が検索結果にある
- **本プロジェクトは 1.62.5 で、`cfBuildOutput` は未指定**。この状態で `cf deploy` が Build Output を得られるか(`cfBuildOutput: true` の追加か、プラグインの 2.0 beta への更新が要るか)は**未確認**。実装時に `cf build` / `cf deploy --dry-run`(どちらも Cloudflare の API を呼ばない)で確かめる

本番シークレット(`DATABASE_URL`):
- 公式の対応表: 「`cf` はまだ単一のシークレットを設定できない」。代わりに次のどれか
  1. `npx wrangler secret put <NAME> --name <WORKER>`(新しい Version を作って即デプロイする)
  2. `cf deploy` / `cf workers versions create` に `--secrets-file <PATH>`(JSON か dotenv 形式のファイル)を渡し、Version と一緒にアップロード
  3. ダッシュボードの Worker → Settings → 変数とシークレットの画面で Secret を追加して Deploy
- `cloudflare.config.ts` では `env: { DATABASE_URL: bindings.secret() }` のように必須シークレットを宣言できる
- 既知の不具合(GitHub cloudflare/cf、公式ドキュメント外)
  - #70「`cf deploy` が既存の Worker シークレットを落とす」: Close 済みで、修正は workers-sdk の PR #15964 とされている。**採用中の beta.12 に修正が入っているかは未確認**。回避策は `bindings.secret()` で宣言しておくこと(未設定ならデプロイが失敗する = fail closed)
  - #96「cf の Worker シークレット更新コマンドが、1 件だけでなくシークレット全体を置き換える」
- Worker の設定例(`cloudflare.config.ts`): 静的アセットは `worker.assets`(`notFoundHandling` / `runWorkerFirst` など)、Rate Limiting は `bindings.rateLimit()`、`workersDev` / `previewUrls` の切り替え、`observability`

出典:
- https://developers.cloudflare.com/cf/projects/
- https://developers.cloudflare.com/cf/projects/build-output/
- https://developers.cloudflare.com/cf/projects/cloudflare-config/
- https://developers.cloudflare.com/cf/get-started/first-worker/
- https://developers.cloudflare.com/cf/ci/
- https://developers.cloudflare.com/cf/wrangler/reference/
- https://developers.cloudflare.com/workers/configuration/secrets
- https://github.com/cloudflare/cf/issues/70
- https://github.com/cloudflare/cf/issues/96
- `apps/api/node_modules/@cloudflare/vite-plugin/dist/index.d.mts`(1.62.5 の型定義)

---

## 未決事項

論点 U1〜U8 と Q1 は 2026-10-12、Q2 は 2026-10-13 にすべて決定済み(下の「決定事項」に転記)。未決事項はなし。

---

## 決定事項

すべて 2026-10-12 の決定。出典は「design.md への記入」(ユーザーが未決事項の末尾に書いた回答)、または「チャット回答」。

### 初回デプロイで公開する中身

- **D1(2026-10-05、出典: ユーザーのチャット回答)**: 初回デプロイで公開する画面は Hello World 程度のプレースホルダーでよい。users 一覧など DB へのアクセスを伴う画面は出さない
  - 理由: 機能実装の前にデプロイ経路だけを通すことが本 issue の目的であり、DB にアクセスする画面はそのまま公開できない(ユーザー要望)
  - 影響: web は静的なプレースホルダーのみ。api 側の扱いは D8 で決着
- **D8(2026-10-12、出典: design.md への記入 U6=A)**: api(`kin-niku-log-api`)を本番に出し、DB に触れない `GET /health` だけを公開する。`/users` は本番に出さない。web のプレースホルダーは API を呼ばない
  - 理由: 本 issue の目的(デプロイ経路の切り分け)に対し、確かめる価値が最も大きいのは api の Worker のデプロイ経路(Vite ビルド → `cf deploy`)で、ヘルスチェックだけなら DB にも費用にも触れない。web → api の経路は API を呼ぶ最初の機能の issue で確かめる
  - 影響: api に `GET /health` を追加し、`/users` のルート登録を外す。ヘルスチェックへのアクセスは Workers Free の 1 日 100,000 件に数えられるが、超えても Error 1027 で止まるだけで課金は発生しない
- **D9(2026-10-12、出典: チャット回答)**: `/doc`(Swagger UI)と `/openapi.yaml` は本番に出さない。ローカル開発でのみ使う
  - 理由: サンプルの users API の構造が外から見えるのを避ける(D2 で作り直す前提)
  - 影響: 本番でこの 2 ルートを無効にする方法が要る(impl.md で方針を決める)

### 費用・クロール対策

- **D3(2026-10-12、出典: design.md への記入 U1=A + チャット回答)**: プランは Workers Free + Neon Free。Cloudflare アカウントが Workers Free プランであることはユーザーが確認済み
  - 理由: 「請求が発生しない」をプランの仕組みで保証できるのは Free だけ。上限超過時は Workers が Error 1027、Neon がコンピュート停止になり課金は発生しない(代わりに止まる)
  - 影響: Paid が必要になった場合は、クロール対策とセットで再検討する。支出の上限を設定する機能が Paid には無い点は調査結果のとおり
- **D4(2026-10-12、出典: design.md への記入 U3=D)**: 追加のクロール対策はしない。robots.txt も置かない。Workers Free の上限に任せる
  - 理由: 初回デプロイで公開するのは静的アセット(無料・無制限)と DB に触れない `/health` だけで、費用面は Free プランが歯止めになる。推奨(robots.txt を置く)とは異なり、置かない方を選んだ
  - 影響: クロールで Free の上限に達すると `/health` が止まるリスクを受け入れる。独自ドメイン取得時の対策(AI ボットのブロック、Bot Fight Mode、WAF レート制限)は別 issue(後続への申し送り参照)

### 公開範囲と認証

- **D5(2026-10-12、出典: design.md への記入 U2=C)**: 初回デプロイは Cloudflare Access なしで公開する。**ユーザー補足: 「Access は使わずに公開はするが、実際に実装する機能の方で認証認可を入れる」**
  - 理由: 初回に公開するものは守るべき DB・データを持たない。Access の設定、支払い情報の登録、Access + CORS の複雑さを持ち込む理由が薄い
  - 影響: **推奨にあった「DB を使う機能を出す時点: A(Access)」は採用しない。** DB を使う機能の時点でも Access ではなく、アプリ側の認証認可(Better Auth 想定)で守る。そのため、調査結果の Access と CORS・Cookie の関係に関する記述は、この方針では当面使わない

### DB

- **D6(2026-10-12、出典: design.md への記入 U4=D)**: 初回デプロイでは DB につながない。本番 Worker に `DATABASE_URL` を登録せず、`cloudflare.config.ts` にも `bindings.secret()` を宣言しない
  - 理由: 経路確認に DB は不要で、既存の users テーブルはサンプルで本番向けには作り直す(D2)ため、つなぐ意味が無い
  - 影響: 「Worker → Neon」の接続経路は初回では確認しない(DB を使う最初の機能の issue で確認する)。Neon ブランチ構成(A〜C)の選択は後続へ
- **D2(2026-10-05、出典: ユーザーのチャット回答)**: 既存の users テーブルはサンプル(sample seed 用)なので、本番向けには作り直すのが筋。本番の users テーブルの設計(Better Auth との関係を含む)は人間主導の学習領域で、本 issue の範囲外
- **D12(2026-10-12、出典: design.md への記入 U8-2=A)**: 初回デプロイで本番 DB に users テーブルを作らない
  - 理由: D6(DB につながない)と一致し、D2 と相容れない「サンプルのまま作る」を避ける
- **D13(2026-10-12、出典: design.md への記入 U8-3=C)**: `production` ブランチに適用済みのサンプル users テーブルは、今は触らない。本番スキーマ設計の issue で U4 の A〜C(Neon ブランチ構成)と一緒に決める
  - 理由: 本 issue では DB につながないので、判断を先送りしても初回デプロイに影響しない
  - 影響: 後続 issue への申し送りに記載

### デプロイ手段・構成

- **D7(2026-10-12、出典: design.md への記入 U5=B)**: web の配信先は Workers の静的アセットだけの Worker `kin-niku-log`。api は `kin-niku-log-api` のまま。#2 の「Pages + Direct Upload」は Worker 名として読み替える
  - 理由: `cf deploy` に揃えられ、#2 の 2 プロジェクト構成を保ったまま Cloudflare の推奨(新規は Workers)に合わせられる
  - 影響: Pages への `cf` デプロイ可否は確認不要になった(判断材料から除外)。本番シークレットは D6 により初回は登録しない。登録方法は DB をつなぐ issue で決める(後続への申し送り)
- **D10(2026-10-12、出典: design.md への記入 U7=A)**: CORS は初回から、本番では web のオリジンだけを許可し、ローカルは `http://localhost:3000` を許可する。許可オリジンは環境ごとに切り替える
  - 理由: 他サイトのページからブラウザ経由で API を叩かれることを防ぐ(CORS はブラウザにしか効かず、クローラーや curl は防げない)
  - 影響: **推奨(初回は変更せず全許可のまま)とは異なる選択。** 初回は web が API を呼ばず守るものが無いが、ユーザーは初回から絞ることを選んだ。許可オリジンを環境ごとに持つ仕組みが要る。本番の web オリジンは web をデプロイして初めて確定する(アカウントの `workers.dev` サブドメインに依存)
- **D11(2026-10-12、出典: design.md への記入 U8-1=B)**: 本 issue では「本番に出ない」ための最小変更だけを行う。api の `/users` ルート登録を外し、web の `/` をプレースホルダーに差し替える。サンプル一式(コード・マイグレーション・seed・生成物・ドキュメント)の削除は、本番の users テーブルを作る issue で行う
  - 理由: D1 を満たす最小の変更で済み、マイグレーションの扱いを本番スキーマの最初のマイグレーションと同時に判断できる
  - 影響: ルート登録を外した api のコード(crud・routes など)と orval の生成物は、それまで使われないまま残る。ローカルで `/users` 画面が使えなくなる点は D14
- **D14(2026-10-12、出典: チャット回答 Q1)**: ローカル開発でもサンプルの users 画面(一覧・追加・削除)と `/users` API が使えなくなってよい。その旨を `docs/sample-users-crud.md` に明記する
  - 理由: 差分を最小に保ち、環境による分岐(U8-1 で退けた C の欠点)を持ち込まない。コードは残り、git の履歴でも参照できる
  - 影響: 本 issue で `docs/sample-users-crud.md` に「画面と `/users` のルート登録は #20 で外した。サンプル一式は本番 users テーブルを作る issue で削除予定」といった注記を加える
- **D15(2026-10-12、出典: チャット回答)**: web(`kin-niku-log`)と api(`kin-niku-log-api`)の両方で、Workers のプレビュー URL(`previewUrls`)を無効にする。公開するのは本番の `*.workers.dev` URL だけにする
  - 理由: 有効のままだと、デプロイしたバージョンごとに本番とは別の URL が誰でもアクセスできる形で発行され、決めた公開範囲より広がる。初回デプロイでプレビュー URL を使う予定は無い
  - 影響: 両 Worker の `cloudflare.config.ts` でプレビュー URL を無効にする(設定方法は実装時に確認)。`workers.dev` 自体は独自ドメインが無いため有効のまま。PR ごとのプレビューが必要になったら CD の issue で再検討する
- **D16(2026-10-12、出典: チャット回答)**: `@cloudflare/vite-plugin` を `2.0.0-beta.sha-91c870c02`(`beta` タグの最新、2026-10-09 公開)に更新し、api(1.62.5 から更新)と web(新規追加)の両方に `^` なしで固定して入れる。web の `vite.config.ts` にもプラグインを組み込む
  - 理由: 実装第 1 周で `cf build` を試したところ、api は「1.62.5 は cf と非互換、v2 beta が必要」、web は「v2 beta のプラグインか wrangler が必要」で失敗した。安定版(`latest` = 1.63.1)は cf と非互換。v2 beta は wrangler に依存しないため、#15 の「wrangler を外す」とも矛盾しない。sha 付きの beta は `^` の範囲が不明瞭なので固定する
  - 影響: beta への依存が増える。web のローカル開発も workerd 上で動くように変わる。beta を更新するときは明示的に上げる
- **D17(2026-10-12、出典: チャット回答)**: web(`apps/web`)の devDependency に `cf` を api と同じ `^1.0.0-beta.12` で追加する
  - 理由: `@cloudflare/vite-plugin` v2 は `vite build` 中に web の `cloudflare.config.ts` を読み、そこで使う `cf/config` を解決できないとビルドが失敗する。`cf/config` を使わない書き方にすると設定ファイルの型チェックが効かなくなる
  - 影響: api と web で同じ指定に揃え、lock 上も同じ版に解決させる
- **D18(2026-10-12、出典: チャット回答)**: `turbo.json` の `build.outputs` を、`@cloudflare/vite-plugin` v2 の実際のビルド出力先(`.cloudflare/output/` 配下)に合わせて本 issue で修正する
  - 理由: D16 でビルド出力が `dist/` から `.cloudflare/output/` に変わり、turbo のキャッシュ対象(`dist/**`)とずれた。ずれたままだと、キャッシュでビルドを飛ばしたときに出力が復元されない。原因が本 issue のプラグイン更新なので同じ issue で直す
  - 影響: 実装第 2 周の対象に加える。`cf deploy` は自前でビルドするため、デプロイ自体への影響は小さい
- **D19(2026-10-12、出典: チャット回答。コードレビュー第 1 周の指摘 F1)**: D14 の注記の範囲を `docs/project-overview.md` にも広げ、「`bun dev` で `/users` が動作することは確認済み」という記述に、#20 で `/users` のルート登録を外したこと(`docs/sample-users-crud.md` 参照)を 1 行追記する
  - 理由: プロジェクト全体の説明に古い記述が残ると、読んだ開発者や AI がルートを登録し直すなど、D11・D14 に反する対応をするおそれがある
- **D20(2026-10-12、出典: チャット回答。コードレビュー第 1 周の指摘 F18)**: web の dev サーバーのポートを 3000 に固定する(Vite の `strictPort: true`。3000 番が使えないときは別ポートで起動せず、エラーにする)。D10 のローカルの許可オリジン(`http://localhost:3000` のみ)は変えない
  - 理由: Vite は 3000 番が使用中だと別ポートで起動し、そのときは将来 web から API を呼んだときに CORS で拒否される。許可オリジンを広げずに、web 側のポートを確実に D10 と一致させる
- **D21(2026-10-13、出典: チャット回答。コードレビュー第 2 周の指摘 G1・G2・G7)**: README.md と docs/project-overview.md に残る、#20 の変更と食い違う記述を本 issue で直す
  - 対象: (1) web のデプロイ先の「Cloudflare Pages」表記(README の技術スタック表、project-overview の技術スタック表と CI/CD の記述)を Workers の静的アセット配信に合わせる(D7) (2) README の web の `dev` コマンドの説明に、Workers ランタイム(workerd)上で動くこと(D16)とポート 3000 固定・使用中ならエラー(D20)を書く (3) `GET /health`(D8)をドキュメントから追えるようにする
  - 理由: D19 と同じく、古い記述が残ると後続の CD の issue などで誤った手順につながる。いずれも数行の修正

### 実装ループ

- **D22(2026-10-13、出典: design.md への記入 Q2=①)**: 実装ループが 3 周の上限に達した時点で残っていた指摘 H1(`docs/sample-users-crud.md`「画面での使い方」の時制の混在、採点 75)だけを直す延長を 1 回だけ認める。手順は 1〜2 文の書き換え → 機械的検証 → 1 レンズの簡易レビュー。指摘 0 件ならコミットに進む
  - 理由: 修正は 1〜2 文で他の箇所に波及しない。#20 で書き直した段落なので、ここで閉じる方が後続の読み手が迷わない
  - 影響: 延長でも指摘が残った場合は、それ以上は回さず再度ユーザーに判断を仰ぐ

---

## 後続 issue への申し送り

| 送り先 | 内容 | 出典 |
|---|---|---|
| DB を使う最初の機能 / 本番スキーマ設計の issue | 本番の users テーブルの設計(Better Auth との関係を含む)。人間主導の学習領域 | D2 |
| 同上 | サンプル一式の削除(コード・`drizzle/0000_*` と meta・`seed.sample.ts`・orval の生成物・`docs/sample-users-crud.md`)。マイグレーション `0000` は `production` ブランチに適用済みの履歴との整合を取る | D11, D13 |
| 同上 | Neon の本番ブランチ構成(`production` を本番にして開発用ブランチを切る / 開発用を残して本番を別に用意 / 別プロジェクト)と、`production` ブランチのサンプルテーブルの扱い(DROP は人間の承認が要る)。#1 の「公開前に判断する」の見直しもここで行う。Free は CU-hours がプロジェクト単位なので、本番と開発を同じプロジェクトに置くと本番の負荷で開発 DB も止まる点に注意 | D6, D13 |
| 同上 | 本番シークレット `DATABASE_URL` の登録方法(ダッシュボード / `wrangler secret put` / `--secrets-file`)と、`bindings.secret()` の宣言。cf の既知不具合 #70・#96 を踏まえる。「Worker → Neon」の接続確認もここ | D6, D7 |
| 認証認可を入れる機能の issue | Access を使わず、アプリ側(Better Auth 想定)で認証認可を行う。web と api が別ホストの場合の Cookie(サードパーティ Cookie 扱いになるおそれ。`workers.dev` が別サイト扱いかは未確認)と CORS の `credentials` の扱いはその issue で決める | D5, D10 |
| web から API を呼ぶ最初の機能の issue | web → api の経路確認(本番の `VITE_API_URL` の受け渡しを含む) | D8 |
| 独自ドメインを取るときの issue | AI ボットのブロック、Bot Fight Mode、WAF レート制限、managed robots.txt(`workers.dev` / `pages.dev` で使えるかは未確認で、独自ドメインが前提と推定)。robots.txt を置くかもそのとき再検討 | D4 |
| 費用が問題になったとき | Paid への移行は、支出上限が無い点を踏まえクロール対策とセットで再検討する | D3 |
| 将来 | 1 Worker 構成(web を api に同梱して同一オリジンにする、U5 の C)は、DB を使う機能を公開する前に別途検討する価値がある | U5 の推奨記述 |
| CD の issue | GitHub Actions からの自動デプロイ。`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を使う | issue 本文 |
