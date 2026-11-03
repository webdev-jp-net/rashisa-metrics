---
name: build-series-data
description: 新しい原資料からシリーズのデータを作り、公開環境（microCMS）へ送るまで進めるスキル。「新しいシリーズを作りたい」「お手本を最新に差し替えてデータを作り直して」「原稿を差し替えたのでシリーズを更新して」「このシリーズを新しい原稿で作り直して」「新しい原資料でレポートのデータを作って公開環境へ送って」などの口語のリクエストで使用。新しいシリーズを作る場合と、既存のシリーズを新しい原資料で作り直す場合の両方を扱う。
---

# シリーズのデータを作る

ユーザーの口語の指示を受け、新しい原資料からシリーズのデータを作り、公開環境（microCMS）へ送るまでを、Claudeが進める。

- 新しいシリーズを作る場合と、既存のシリーズを新しい原資料で作り直す場合の、両方をこの1つのスキルで扱う。
- 手順は新しく作らない。実行順の正本は[`_llm-docs/analysis/data-layout.md`](../../../_llm-docs/analysis/data-layout.md)の「生成順序と依存関係」で、入口は[`_llm-docs/project.md`](../../../_llm-docs/project.md)の「できることと入口」。このスキルはその順序をなぞる。
- 各工程の詳細はここに書き写さない。該当する仕様書の節を読んで従う。
- 用語は[`_llm-docs/operation/dictionary.md`](../../../_llm-docs/operation/dictionary.md)に従う。

## 前提

- 作業対象のシリーズは、各コマンドの引数`--series <seriesKey>`で選ぶ。`data/index.json`が全シリーズの設定を持つ（[データ配置](../../../_llm-docs/analysis/data-layout.md#dataindexjson)）。
- 成果物は`data/<seriesKey>/`、原資料は`data/index.json`の`modelSource`・`editedSource`が指す`source/`配下に置く。

## Step 1: 要る情報を集める

次の情報が要る。ユーザーの指示や手元の原資料から分かるものは聞かない。**分からないものがあれば、そのときエージェントがユーザーに聞く**。

- 新しいシリーズか、既存のシリーズの作り直しか（`data/index.json`のそのシリーズの`seriesKey`を新しく決めるか、microCMSの既存のシリーズに揃えるかが決まる）
- お手本の記事と、編集対象の原稿の場所
- 編集対象の原稿をどこでスコープに区切るか
- 匿名化で除く語
- スコープの表示名、お手本媒体と編集対象媒体の表示名、閲覧を許可するアカウント（microCMSの`series`に登録する）

## Step 2: 原資料と設定を整える（Claudeが行う）

仕様は[データ配置](../../../_llm-docs/analysis/data-layout.md)の「`<editedSource>/index.json`」「`source/`」。

1. お手本の記事を`modelSource`に、1記事を1つの`.md`として置く。
2. 編集対象の原稿を、スコープごとのファイルに区切って`editedSource`に置く。
3. `editedSource`直下の`index.json`（原稿の`index.json`）に、スコープの`id`と`file`の対応を書く。
4. `data/index.json`に、そのシリーズの設定（`seriesKey`・`modelSource`・`editedSource`・`anonymization`）を足す。新しい`seriesKey`は英数字・`-`・`_`だけで決める（画面のパスになり、それ以外の文字は404になる）。既存のシリーズの作り直しでは、差し替えに合わせて該当の件を更新する。
5. 新しいシリーズでは、成果物の置き場`data/<seriesKey>/`を作る。

## Step 3: microCMSの`series`を登録する（Claudeが行う）

原稿の`index.json`ができたら、それとStep 1で聞いた内容をもとに、ClaudeがAPIで`series`を登録する。フィールドは[microCMS連携仕様](../../../_llm-docs/spec/microcms.md)の`series`を参照する。

- **新しいシリーズ**: 次を書く。
  - スコープの一覧（`scopeId`は原稿の`index.json`の`id`）と表示名
  - お手本媒体・編集対象媒体の表示名
  - 許可リスト
  - タイトル「文体解析レポート」、リード文「「らしさ」を数値的・客観的に観測する」（API経由の登録では初期値が入らないので、初期値と同じ文を書く）
  - 導入文（`description`）に`src/lib/api/microcms.ts`の`DEFAULT_DESCRIPTION`（同じ理由で、初期値と同じ文を書く）
- **既存のシリーズの作り直し**: スコープの一覧（`scopeId`と表示名）だけを書き換え、ほかの項目は触らない。

呼び出しは、既存の`src/lib/api/microcms.ts`の`createReportClient()`を`bun --env-file=.env.local`で使う。エンドポイントは`series`、新規は`create`、更新は`update`。スコープの繰り返しの行は`fieldId: 'scope'`・`scopeId`・`label`を持つ。新しいスクリプトファイルは作らない。

## Step 4: データを作る

[生成順序と依存関係](../../../_llm-docs/analysis/data-layout.md#生成順序と依存関係)の1〜4を、書かれた順に実行する。

1. extract（`scripts/extract.ts`の`prepare`、続けてagentが実例集・書き方シート・統合文書を書き、`verify`が通ること）。仕様は[抽出処理](../../../_llm-docs/analysis/extraction.md)
2. build-report（`scripts/build-report.ts`）
3. スコープごとの変更案（`scripts/revision.ts`、全スコープの公開は`scripts/build-chapter-diffs.ts`）。仕様は[章単位編集案](../../../_llm-docs/analysis/revision-workflow.md)
4. `finding_texts.json`（総評）。仕様は[見出し付き総評](../../../_llm-docs/analysis/findings.md)

- 既存のシリーズで差し替えていない媒体の成果物を作り直さなくてよい条件、および編集対象を差し替えたときに必ず行う工程は、同じ節に従う。
- 各コマンドの引数は、対応する`scripts/`配下ファイルの`main`のJSDoc（`@example`）に従う。

## Step 5: 公開環境へ送る（Claudeが実行する）

`scripts/cms.ts`の`push`、続けて`import-findings`の順にClaudeが実行する（総評を書き込む先の`report`は`push`が作る）。使い方は同ファイル`main`の`@example`。送信の仕様は[データ配置](../../../_llm-docs/analysis/data-layout.md#公開環境への送信)と[microCMS連携仕様](../../../_llm-docs/spec/microcms.md)。

## Step 6: 結果を確かめる

- `extract verify`が通っている。
- `push --check`で差分が無い。
- `push --check`は総評（`findingList`）を比べないので、総評は画面で、そのシリーズのレポート（総評を含む）が表示されることを確かめる。
