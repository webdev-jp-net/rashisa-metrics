# RASHISAメトリクス

お手本の媒体と編集対象の媒体を4観点・26指標の文体計測で比較し、スコープごとに「お手本へ寄せる変更案」と見出し付き総評を表示するレポート。仕様は `_llm-docs/project.md` から辿る。エージェントの運用ルールと制御機構はllm-baseの型（`AGENTS.md`、`_llm-rules/`、`.claude/`）をそのまま持つ。

## 前提

- Node.jsとpnpm（Next.js・prettier・textlint・tsc）
- bun（テストとCLIの実行、hook）
- jq（`.claude/settings.json` のhook）
- Git、GitHub CLI（`gh`）
- `source/` に原資料ディレクトリ（お手本・編集対象。1文書＝1ファイル）、`data/` に全シリーズの設定 `index.json` とシリーズごとのデータ一式（`data/<seriesKey>/`）を置く（どちらも非追跡）。コマンドは `--series <seriesKey>` で作業対象のシリーズを選ぶ
- Vercelで公開する場合、ユーザーの初期設定（コード変更は伴わない）が要る：microCMSのサービス作成と`series`・`report`の2API作成（[microCMS連携仕様](./_llm-docs/spec/microcms.md)のフィールド一覧のとおりに管理画面で作る）、Google Cloud ConsoleでのOAuthクライアント作成（[NextAuth認証仕様](./_llm-docs/spec/backend/next-auth.md)）、環境変数6個の設定（`.env.example`参照）

## 導入

```bash
pnpm install --frozen-lockfile
```

`_llm-memories/templates/` の3ファイルを `_llm-memories/` 直下へコピーしてから着手する。

## 実行

```bash
pnpm dev          # http://localhost:3000/ にレポートを表示
pnpm build
pnpm typecheck
pnpm test         # bun test（ライブラリ・CLI・hook）。実データのテストは SERIES_KEY=<seriesKey> を付けたときだけ走る
pnpm format
```

計測・変更案のCLIは `_llm-docs/project.md` と `_llm-docs/analysis/` を参照する。
