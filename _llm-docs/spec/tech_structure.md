# 技術構成

## フロントエンド

- Next.js App Router
- React + TypeScript
- SCSS Modules（グローバルスタイルは`src/styles/index.scss`）
- 図表は外部チャートライブラリを使わず、CSSベースのバー表示をコンポーネント化する

## 主要ライブラリ

- `next` / `react` / `react-dom`
- `typescript`
- `sass`
- YAMLパーサー: `config/lsm_categories.yaml`・`config/keigo_lexicon.yaml`の読込
- 形態素解析器: `lindera-wasm-unidic-nodejs`（UniDic辞書、WASM実装、同期API）
- `next-auth`: Googleログイン（[NextAuth認証仕様](./backend/next-auth.md)）
- `microcms-js-sdk`: 画面が読む表示材料の取得（[microCMS連携仕様](./microcms.md)）
- 開発時: `prettier`、`textlint`、`@types/bun`

行差分・語差分は外部ライブラリを使わず、`src/lib/diff/sequence-matcher.ts`がPythonの`difflib.SequenceMatcher`（`isjunk=None, autojunk=False`）を自前移植して計算する。

## ディレクトリ概要

全体の構成は[プロジェクト概要のディレクトリ一覧](../project.md#ディレクトリ一覧)を参照。`src/lib`配下の各モジュールの役割は次のとおり。

| パス               | 役割                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/config`   | 作業対象シリーズの設定読込（`config/report.json`、`data/index.json`、`<editedSource>/index.json`）                             |
| `src/lib/data`     | `data/`と`source/`のJSON・原資料の読込と型                                                                                     |
| `src/lib/text`     | 文書の前処理（スコープ本文と元ファイルの行番号列）、匿名化（clean・表示用マスク）、PATTERN_LIST                                |
| `src/lib/morph`    | 解析器アダプタ（surface・pos1・pos2・lemma・document）                                                                         |
| `src/lib/metrics`  | 26指標の計測（LSMカテゴリ、文末表現、敬語密度、文・段落長、句読点、n-gram）                                                    |
| `src/lib/policy`   | 判定規則overview-3（強調・分類・方向）と総括文の生成                                                                           |
| `src/lib/revision` | 指標仕様、budget、候補の適用と評価、公開データの組み立て、説明文検査                                                           |
| `src/lib/extract`  | 抽出処理（`extract prepare`/`extract verify`）の実装。原資料の列挙・計測・プロファイル生成・実例集/書き方シート/統合文書の検査 |
| `src/lib/diff`     | 行差分・語差分の組み立て                                                                                                       |

`tools/find-cliche`のみPythonで、生成器はこの環境では動かない（[データ配置](../analysis/data-layout.md#toolsfind-cliche)参照）。

## 設定とデータの配置

必須の環境変数は6個: `NEXTAUTH_URL`・`NEXTAUTH_SECRET`・`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`MICROCMS_SERVICE_DOMAIN`・`MICROCMS_API_KEY`（詳細は[NextAuth認証仕様](./backend/next-auth.md)・[microCMS連携仕様](./microcms.md)を参照）。画面（`src/app/page.tsx`・`layout.tsx`）はDBを持たずmicroCMSを読む。計測・変更案生成・抽出処理・送信コマンドといったローカルの処理は、ファイル（JSON・YAML・Markdown）を入力にする。

設定は追跡対象の`config/report.json`（シリーズに依らない値。辞書のパス）と、非追跡の`data/index.json`（全シリーズの設定の配列。1件が1シリーズ＝お手本と編集対象の組に固有の値で、`seriesKey`・`modelSource`・`editedSource`・`anonymization`だけを持つ）、編集対象の原資料ディレクトリ直下の`index.json`（スコープごとの`id`と原稿の`file`の配列。`id`の正本）に分かれる。成果物の置き場は設定に書かず、`data/<seriesKey>/`の下の決まった構成から導く。表示名（スコープ・媒体・画面のタイトルとリード文）は手元の設定に持たず、microCMSの`series`が持つ。シリーズは複数あり、すべてのコマンドが引数`--series <seriesKey>`で作業対象を選ぶ。`loadReportConfig`が`data/index.json`からそのシリーズの1件を探し、`config/report.json`と`<editedSource>/index.json`と合わせて1つの`config`に合成する。コードはこの合成後の`config.seriesKey`・`config.pathList`・`config.scopeList`・`config.anonymization`を読む（直書きしない）。スコープの件数は`config.scopeList`の件数で、コードは固定の件数を持たない。`data/index.json`が無い、`seriesKey`のシリーズが無い、または`<editedSource>/index.json`が無い場合は、そのパスやシリーズを名指ししたエラーで止まる。

原資料・計測結果・変更案・総評は、リポジトリ直下の非追跡ディレクトリ`source/`（お手本・編集対象それぞれの原資料ディレクトリ。どの処理も書き込まない）と`data/`（シリーズの設定`index.json`と、シリーズごとのディレクトリ`data/<seriesKey>/`に置く計測結果・変更案・総評・find-cliche生成物）に置く。スキーマと入出力関係は[データ配置](../analysis/data-layout.md)を参照。
