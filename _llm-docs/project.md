---
description: Overview
---

# プロジェクト概要

RASHISAメトリクスは、「らしさ」を数値で観測する文体比較レポート。

お手本媒体と編集対象媒体の組（シリーズ）を、4観点・26指標の文体計測で比較するレポート。全体および個別スコープごとに、お手本へ寄せる変更案（diff提案）と見出し付き総評を表示する。シリーズは複数あり、公開環境ではシリーズごとのパス（`/<seriesKey>/`）でそれぞれを描画する。手元の作業は、全シリーズの設定を並べた`data/index.json`から、各コマンドの引数`--series <seriesKey>`で選んだ1シリーズずつ行う。

## 目的と対象外

- **目的**: シリーズごとに、お手本媒体と編集対象媒体を4観点・26指標で比較し、スコープ（全体・個別スコープ）ごとにお手本へ寄せる変更案（diff提案）と見出し付き総評を表示する
- **対象外**: Slack DMの二者検証。スコープの件数と区切りはシリーズごとに`<editedSource>/index.json`が持ち、媒体名・スコープの表示名はmicroCMSの`series`が持つ

## できることと入口

作業の種類ごとに、何が起きるか・仕様書・実行の入口を、データが流れる順に並べる。原稿やお手本を差し替えるときは、上から順に再実行する（実行順の正本は[データ配置の生成順序と依存関係](./analysis/data-layout.md#生成順序と依存関係)）。

| 作業                                                               | 何が起きるか                                                                                                                                                                                                                                            | 仕様書                                                                                       | 実行の入口                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 新しいシリーズを作る、または既存のシリーズを新しい原資料で作り直す | ユーザーの口語の指示を受けて、エージェントが原資料の配置・設定・microCMSの`series`を整え、計測データの作成から公開環境への送信までを順に進める                                                                                                          | [データ配置の生成順序と依存関係](./analysis/data-layout.md#生成順序と依存関係)               | `.claude/skills/build-series-data/SKILL.md`（`build-series-data`スキル）                                                                       |
| 原稿・お手本を差し替えて計測データを作る                           | 原資料ディレクトリ（お手本は1記事1ファイル、編集対象は1スコープ1ファイル）から文体プロファイルを作り、agentが書いた実例集・書き方シート・統合文書を検査する                                                                                             | [抽出処理](./analysis/extraction.md)                                                         | `scripts/extract.ts`（`prepare`／`verify`。`prepare --check`は差し替え後の再現確認用で、差し替え直後は不一致になる）                           |
| 比較データと一覧の根拠を作る                                       | プロファイルから`comparison_data*.json`と`overview_criteria.json`を生成し、強調・分類・総括を判定する                                                                                                                                                   | [判定規則](./analysis/overview-policy.md)                                                    | `scripts/build-report.ts`                                                                                                                      |
| 変更案を作り、評価し、公開する                                     | スコープごとに計画→agentの候補作成→一括評価→公開。表示文の検査と説明文だけの更新もここ                                                                                                                                                                  | [章単位編集案](./analysis/revision-workflow.md)                                              | `scripts/revision.ts`（1スコープ）、`scripts/build-chapter-diffs.ts`（全スコープの公開をまとめて）、`scripts/proposal-text.ts`（表示文の検査） |
| 総評を書く                                                         | 比較データと実例集を根拠に、スコープ×観点の見出し付き本文を書く                                                                                                                                                                                         | [見出し付き総評](./analysis/findings.md)                                                     | microCMSの管理画面で直接書く、または`data/<seriesKey>/report/finding_texts.json`を編集して`scripts/cms.ts import-findings`                     |
| 変更案を原稿に反映する                                             | 公開済みの変更案をスコープごとのファイルに書き戻し、改稿版一式を出力する                                                                                                                                                                                | [章単位編集案](./analysis/revision-workflow.md)の原稿への書き戻し                            | `scripts/apply-to-manuscript.ts --out <dir>`                                                                                                   |
| レポートを表示する                                                 | microCMSから、パス（`/<seriesKey>/`）で指定したシリーズの設定・比較データ・総評・変更案を読み、リクエスト時に描画する。そのシリーズの許可リストにあるGoogleアカウントでログインした人にだけ表示する。許可リストが空のシリーズはログインせずに表示できる | [画面構成と挙動](./spec/frontend/screen.md)、[NextAuth認証仕様](./spec/backend/next-auth.md) | `pnpm dev`                                                                                                                                     |
| 公開環境（microCMS）へ送る                                         | 引数`--series`のシリーズ（microCMSに登録済みのもの）へ、ローカルの比較データ・変更案材料を送る。送信前に原稿と変更案のハッシュが一致するか検査し、不一致なら送らない。総評は別コマンドで移す                                                            | [microCMS連携仕様](./spec/microcms.md)                                                       | `scripts/cms.ts`（`push [--check]`、`import-findings <path>`）                                                                                 |
| 表示するシリーズを切り替える                                       | ルート（`/`）に、その人が閲覧できるシリーズの一覧を出す（許可リストが空のシリーズはログイン前から出る）。シリーズ名を選ぶと、そのシリーズのパスでレポートを開く。再デプロイは要らない                                                                   | [画面構成と挙動](./spec/frontend/screen.md)                                                  | ブラウザでルート（`/`）を開く                                                                                                                  |
| 英語定型の直訳を検出する                                           | 原稿の英訳から英語圏の定型表現に由来する文を検出し、言い換え案を添える。採否は人が決め、選んだ項目を原稿へ反映する。この環境では生成器（`tools/find-cliche`、Python）は動かず、保存済み結果を読む                                                       | [データ配置](./analysis/data-layout.md#toolsfind-cliche)                                     | `data/<seriesKey>/find-cliche/find-cliche.html`をブラウザで開く（採用項目の反映用データは同ディレクトリの`find-cliche.jsonl`）                 |

各コマンドの引数と使い方は、対応する`scripts/`配下ファイルの`main`のJSDoc（`@example`）を正本とする。

## 技術基盤

| 項目                  | 内容                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 言語・ランタイム      | TypeScript                                                                                                                                                                       |
| フレームワーク        | Next.js（App Router）、React                                                                                                                                                     |
| パッケージマネージャ  | pnpm                                                                                                                                                                             |
| テスト                | `bun test ./tests ./.claude/hooks`（`pnpm test`）                                                                                                                                |
| スタイル              | SCSS Modules                                                                                                                                                                     |
| データストア・外部API | 画面はmicroCMS（設定・表示材料）とGoogle OAuth（NextAuth）を読む。ローカルの計測・変更案生成・送信コマンドの入力は`data/`配下のJSONファイルと`source/`配下の原稿・お手本コーパス |
| 形態素解析器          | `lindera-wasm-unidic-nodejs`（UniDic辞書、WASM実装、同期API）。`src/lib/morph/`のアダプタでsurface・pos1・pos2・lemmaを揃える                                                    |
| ホスティング          | Vercel                                                                                                                                                                           |

バージョンは承認なしに変更しない（`_llm-rules/core_rules.md`）。

## ディレクトリ一覧

| パス                        | 役割                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/app`                   | 画面（App Router）。詳細は[ルーティング仕様](./spec/frontend/routing.md)                                            |
| `src/app/_parts/components` | 共通部品。詳細は[コンポーネント設計](./spec/frontend/components.md)                                                 |
| `src/lib`                   | 計測・判定・変更案生成・抽出処理のロジック。モジュールの役割は[技術構成](./spec/tech_structure.md#ディレクトリ概要) |
| `src/styles`                | グローバルSCSS・変数・mixin                                                                                         |
| `scripts`                   | CLI（bun実行）                                                                                                      |
| `config`                    | 設定・辞書。詳細は[データ配置](./analysis/data-layout.md#config)                                                    |
| `data`                      | 非追跡データ一式。詳細は[データ配置](./analysis/data-layout.md)                                                     |
| `source`                    | 非追跡の原資料。詳細は[データ配置](./analysis/data-layout.md#source)                                                |
| `tools/find-cliche`         | 英語定型の直訳検出（Python）                                                                                        |
| `tests`                     | bun test                                                                                                            |
| `.claude/hooks`             | `read-gate.ts`等のフック本体とテスト                                                                                |
| `_llm-docs`                 | 仕様書                                                                                                              |

## 開発コマンド

```bash
pnpm dev        # 開発
pnpm build      # ビルド
pnpm typecheck  # 型チェック
pnpm format     # 整形
pnpm test       # テスト（./tests と ./.claude/hooks を対象にする。実データのテストは SERIES_KEY=<seriesKey> を付けたときだけ走る）
```

## 詳細仕様の索引

### レポート機能とデザインの仕様

- [システム全体仕様](./spec/index.md) - 機能概要
- [レポート仕様](./analysis/index.md) - 抽出処理・4観点・26指標・提案・総評の仕様
- [デザインシステム](./spec/design-system.md) - トークン・書体・装飾の仕様

### 技術スタックとフロントエンドの仕様

- [技術仕様](./spec/tech_structure.md) - システム全体の技術スタック・アーキテクチャ
- [フロントエンド仕様](./spec/frontend/index.md) - ルーティング・コンポーネント・スタイル
- [NextAuth認証仕様](./spec/backend/next-auth.md) - Googleログインと許可リストによる閲覧制限
- [microCMS連携仕様](./spec/microcms.md) - 画面が読む表示材料のフィールド定義と送信コマンド

### 開発用語の統一規約

- [開発用ネーミング辞書](./operation/dictionary.md) - 開発時の統一的なネーミング規約
- [UI/UX表記規約](./operation/naming-ui-ux.md) - UI文言（ボタン・リンク・メッセージ）の書き方の統一規約
