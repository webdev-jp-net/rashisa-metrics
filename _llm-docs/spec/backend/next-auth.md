# NextAuth認証仕様

## 概要

Google OAuthを利用したNextAuth.js 4系の構成。JWTセッションストラテジーでユーザー情報を保持する。データベースは使用せず、microCMSと組み合わせてシリーズごとの閲覧制限を行う。

閲覧制限はシリーズごとに「そのシリーズのレポートを通す・通さない」の1段階だけ。誰でもGoogleアカウントでサインインできるが、レポート本体（`ReportView`）を閲覧できるかどうかは、サインイン後のメールアドレスがパスのシリーズの許可リスト（microCMSの`series.allowList`、[microCMS連携仕様](../microcms.md)参照）に一致するかで判定する。許可リストが空のシリーズのレポートは、サインインせずに閲覧できる。

セッション取得はサーバー側で完結させる方針を採り、`SessionProvider`/`useSession`は使用しない。`src/app/page.tsx`・`src/app/[seriesKey]/page.tsx`（Server Component）が`getServerSession`でセッションを取得し、その場で許可リストと照合する。ログイン・ログアウトの操作ボタンは、必要箇所（`SeriesIndex`・`LoginPrompt`・`Footer`）でクライアントコンポーネントから直接`next-auth/react`の`signIn`/`signOut`を呼ぶ。

## 環境変数

- `NEXTAUTH_URL`: アプリのベースURL
- `NEXTAUTH_SECRET`: JWT署名キー（ランダム生成）
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`: Google Cloud Consoleから取得

## ディレクトリ構成

- `src/lib/auth.ts`: `authOption`の定義
  - Google Provider設定。`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`は未設定でもビルドを止めないよう空文字にフォールバックする
  - `authorization.params.prompt`は`'select_account'`。指定が無いと、ブラウザにGoogle自体のログインが残っている場合`signOut()`後も直前のアカウントで自動的に再認証され、別アカウントを選べなくなる
  - `signIn`コールバックは常に`true`を返す（サインイン自体は誰にでも許可し、閲覧可否はページ側の許可リスト判定に委ねる）
  - `jwt`コールバックは、サインイン直後だけ渡るGoogleのプロフィールからメール・名前・アイコンをトークンへ写す。許可リストのドメイン一致が本人確認済みのメールだけを対象にするため、`email_verified`が`true`のときだけメールを写し、`false`のときはトークンのメールを`undefined`にする（NextAuthはこのコールバックを呼ぶ前にサインインしたメールをトークンへ既定値として埋めているため、`false`の場合に明示的に消さないと未確認のメールがそのまま残る）
  - `session`コールバックはトークンの値をセッションへ写す。許可リスト照合が読むのは`session.user.email`
  - `pages.signIn`は`'/'`（専用のログインページは持たず、ルートのシリーズの一覧がログインのボタンを兼ねる）
  - `session.strategy`は`'jwt'`
- `src/lib/permission.ts`: `isAllowedViewer(session, allowListText)`。シリーズの閲覧可否を判定する
- `src/app/api/auth/[...nextauth]/route.ts`: NextAuthの`GET`/`POST`ハンドラー（`/api/auth/*`の全経路を1つで処理する）
- `src/app/page.tsx`: ルート。`getServerSession(authOption)`と`getSeriesList(client)`の全シリーズを並行取得し、`isAllowedViewer`で絞って`SeriesIndex`に渡す（未ログインなら許可リストが空のシリーズだけが残る）
- `src/app/[seriesKey]/page.tsx`: `getServerSession(authOption)`と`getSeriesByKey(client, seriesKey)`（パスのシリーズ）を並行取得し、`isAllowedViewer`が`false`なら`LoginPrompt`を返す（許可されない閲覧者には`getReportList`を呼ばない）
- `src/app/_parts/components/LoginPrompt/`: ログイン促し画面。`useLoginPrompt.ts`が状態（`signedOut`/`notAllowed`）ごとの文言を返し、ボタンのクリックで`signIn('google')`または`signOut()`を呼ぶ。`signIn`はハッシュを含まない`callbackUrl`を明示する（未ログイン画面を開いていた時点のURLハッシュは、ログイン後のスコープ選択としては意味を持たないため）
- `src/app/_parts/components/SeriesIndex/`: ルートの画面。`useSeriesIndex.ts`がボタンのクリックで`signIn('google')`（ルートへ戻る`callbackUrl`を明示する）または`signOut()`を呼ぶ
- `src/app/_parts/components/Footer/`: レポート表示中のページ末尾（非追従）にあるログアウトリンク。ログインしているときだけ出す。`useFooter.ts`がクリックを受けて`signOut()`を呼ぶ（修飾キー付き・中クリックは、新規タブで開く等のブラウザ標準の挙動を優先してそのまま通す）

認証操作専用の共有コンポーネントは持たない。`signIn`/`signOut`を呼ぶボタンは`SeriesIndex`・`LoginPrompt`・`Footer`にそれぞれ直接実装する。

## アクセス制限

シリーズごとの許可リスト方式。スコープ単位の公開範囲は持たない。

- 許可リストの正本はmicroCMSの`series.allowList`（1行1件、ユーザーがシリーズごとに管理画面で書く）。判定に使うのはパスのシリーズの許可リスト。ルートの一覧は、全シリーズをそれぞれの許可リストで判定して絞る
- 各行はトリム・小文字化して比較する。`@`を含む行はメールアドレスの完全一致、含まない行はドメイン一致（ログインユーザーのメールアドレスの、最後の`@`より後ろの部分と比較する）
- 判定対象はGoogleの`email_verified`が`true`のメールアドレスだけ。`false`のときは`jwt`コールバックがトークンのメールを`undefined`にするため、`session.user.email`が`undefined`になり許可リストと一致しない
- 許可リストが空・未設定（`allowList`フィールドを1件も登録していない）なら、未ログインを含め誰でも通す

## ルート保護

ミドルウェア（`src/middleware.ts`）による一括保護は行わない。保護は`/<seriesKey>/`（`[seriesKey]/page.tsx`）1箇所だけで、リクエストのたびに`isAllowedViewer`を呼んで判定する。非許可・未ログインの場合は`notFound()`ではなく`LoginPrompt`を返す。

## フロー

1. `/<seriesKey>/`にアクセスすると、`[seriesKey]/page.tsx`が`getSeriesByKey(client, seriesKey)`（パスのシリーズ。許可リスト・タイトル・スコープ一覧を含む）と`getServerSession(authOption)`（セッション）を並行取得する。`seriesKey`が英数字・`-`・`_`以外を含む、またはmicroCMSに該当するシリーズが無ければ、ログイン判定より前に404を返す
2. `isAllowedViewer(session, series.allowList)`が`false`なら、未ログインは`'signedOut'`、ログイン済みだが非許可なら`'notAllowed'`の状態で`LoginPrompt`を返す
3. `LoginPrompt`のボタンは、`signedOut`なら「ログインする」（`signIn('google')`でGoogleの認証画面へ遷移）、`notAllowed`なら「ログアウトする」（`signOut()`）
4. Googleでの認証後、`jwt`コールバックが`email_verified === true`のときだけメールアドレスをトークンへ写し（`false`ならトークンのメールを`undefined`にする）、`session`コールバックが`session.user.email`へ渡す
5. `isAllowedViewer`が`true`なら、`page.tsx`は続けて`getReportList(client, series.id)`でパスのシリーズの`report`だけを取り、`buildReportModel`でレポート本体（`ReportView`）を描画する。そのシリーズの`report`が0件、または`scopeList`と揃わなければ、欠けている`scope`を名指ししたエラーで止まる
6. レポート表示中、ログインしていれば`Footer`の「ログアウトする」リンクから`signOut()`を呼べる。JavaScriptが動かない環境向けに、リンクの遷移先自体はNextAuthのサインアウト画面（`/api/auth/signout`）を指す

## 関連ドキュメント

- [microCMS連携仕様](../microcms.md)
- [ルーティング仕様](../frontend/routing.md)
