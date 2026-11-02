# データ配置

計測パイプラインが読み書きするファイルのスキーマと入出力関係。設定の分割・`source/`・`data/`という配置の仕組みは[技術構成](../spec/tech_structure.md#設定とデータの配置)を参照。

## config/

手作業で保守する設定・辞書。生成物ではない。

| ファイル              | 内容                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `lsm_categories.yaml` | LSM10カテゴリの`posFilter`/`lemmaList`/`extraLemmaList`、モーダル否定除外設定、`minTokens` |
| `keigo_lexicon.yaml`  | 敬語3分類（尊敬語・謙譲語・丁寧語）の辞書形リストと表層パターン                            |
| `report.json`         | `pathList`（`lsmCategories`・`keigoLexicon`の相対パス）だけを持つ                          |

## data/index.json

非追跡。全シリーズの設定の配列で、1件が1シリーズ。1件は`seriesKey`（microCMSの`series.seriesKey`と同じ値で、`data/<seriesKey>/`のディレクトリ名にもなる。送信コマンドが送り先のシリーズを引くのにも使う）、`modelSource`・`editedSource`（お手本・編集対象の原資料ディレクトリ。リポジトリルートからの相対パス）、`anonymization`（`model`・`edited`それぞれの入力整形の用語・例外・著者用語）だけを持つ。成果物の置き場は設定に書かず、`seriesKey`から導く。表示名（スコープ・媒体・画面のタイトルとリード文）は持たず、microCMSの`series`が持つ。

設定を読むコマンドはすべて引数`--series <seriesKey>`を取り、この配列から該当する1件を探す。ファイルが無い、`seriesKey`の件が無い、または重複していればエラーで止まる。シリーズを増やすときは、配列に1件足して`source/`に原資料を置き、成果物の置き場`data/<seriesKey>/`を作り、microCMSの`series`を登録する。

## `<editedSource>/index.json`

非追跡（`source/`配下）。スコープと原稿ファイルの対応。編集対象の原資料ディレクトリ直下に置く、`{id, file}`の配列で、スコープごとに1件。`id`はスコープのキー（`comparison_dataN.json`・`planN.json`等のN、microCMSの`series.scopeList[].scopeId`、`scope<N>`ディレクトリのN）で、0始まりの連番には限らない。`id`の正本はこのファイルで、重複は不可。`file`は同じディレクトリ内の原稿ファイル名で、重複は不可。スコープの順序が要る処理は、配列の並びではなく`id`昇順で扱う。

## `data/<seriesKey>/`

非追跡。シリーズごとの成果物の置き場。直下は次の構成で、各ディレクトリの名前はコードが`seriesKey`から導く。

- `profiles/model/`・`profiles/edited/`・`profiles/edited/scope<N>/`：計測済みプロファイル
- `report/`：比較データ・一覧の根拠データ・公開済みの変更案・総評の原稿
- `propose/`：変更案の作業領域
- `find-cliche/`：クリシェ判定の結果

## `data/<seriesKey>/profiles/`

非追跡。計測済みプロファイル。お手本（`model/`、単一）と編集対象（`edited/`が全体1件、`edited/scope<N>/`がスコープ別で`<editedSource>/index.json`の件数分。Nはスコープid）に分かれる。各ディレクトリの`stylometric_profile.json`（[計測仕様](./measurement.md#プロファイルjsonの形状)参照）は`extract prepare [--check]`（[抽出処理](./extraction.md)）が原資料ディレクトリ（`modelSource`・`editedSource`）から生成・再生成する。`--check`は保存済みプロファイルとの照合だけを行い、ファイルへは書き込まない。

お手本・編集対象それぞれの全体を計測するディレクトリ（`model/`・`edited/`）には、`stylometric_profile.json`に加えて`author_writing_sheet.md`・`expert_synthesis.md`・`exemplar_bank.jsonl`をagentが書き、`extract verify`がその内容を検査する（検査条件は[抽出処理](./extraction.md#extract-verify)を参照）。スコープ別ディレクトリ（`edited/scope<N>/`）は`stylometric_profile.json`だけを持つ。

## `data/<seriesKey>/report/`

非追跡。

| ファイル                 | 入力/生成 | 生成元                                                                            | 内容                                                                                                                        |
| ------------------------ | --------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `comparison_data.json`   | 生成      | build-report                                                                      | 全体スコープの比較データ（[判定規則](./overview-policy.md#comparison_datajson)参照）                                        |
| `comparison_dataN.json`  | 生成      | build-report                                                                      | スコープ別の比較データ（Nはスコープid）。`label`はプレースホルダー`{scopeList.label:N}`                                     |
| `overview_criteria.json` | 生成      | build-report                                                                      | 27項目の判定結果一式（[判定規則](./overview-policy.md#overview_criteriajson)参照）。`comparison_data*.json`を読んで生成する |
| `diff_dataN.json`        | 生成      | revision.ts publish（build-chapter-diffsは全スコープのpublishをまとめて実行する） | スコープごとの公開済み変更案（[章単位編集案](./revision-workflow.md#diff_datanjson)参照）。`version`は`chapter-revision-4`  |
| `preface_diff_data.json` | 生成      | 同上（スコープ0の複製）                                                           | `diff_data0.json`と同内容                                                                                                   |
| `finding_texts.json`     | 入力      | 手作業／agent                                                                     | 見出し付き総評の本文（[見出し付き総評](./findings.md)参照）。生成スクリプトはこのファイルを読むだけで書き換えない           |

## `data/<seriesKey>/propose/`

非追跡。`chapter-revision-4`の作業領域。スコープごとに3ファイル。

| ファイル           | 入力/生成 | 生成元                                                  | 内容                                                                                                               |
| ------------------ | --------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `planN.json`       | 生成      | revision.ts prepare                                     | スコープの全block・26指標仕様・standout target一覧とbudget（[章単位編集案](./revision-workflow.md#plannjson)参照） |
| `candidatesN.json` | 入力      | agent                                                   | 候補・target別結論・`finalReview`（[章単位編集案](./revision-workflow.md#candidatesnjson)参照）                    |
| `evaluationN.json` | 生成      | revision.ts evaluate（`publish`内部でも再利用・再生成） | 一括適用した計測結果・確認事項・残差（[章単位編集案](./revision-workflow.md#evaluationnjson)参照）                 |

## source/

非追跡（`.gitignore`対象）。原資料ディレクトリの置き場。編集対象媒体は`data/index.json`の`editedSource`（1スコープ＝1ファイル）、お手本媒体は`modelSource`（1記事＝1ファイル）が指す。どの処理も書き込まない。原稿・お手本記事の差し替え、編集対象原稿のスコープ分割は抽出処理の外の作業で、ユーザーの口語の指示を受けてエージェントが`build-series-data`スキルで行い、その結果に合わせて設定を更新する。編集対象の各ファイルは原稿の連続した行範囲をそのまま切り出したもので、見出し記号・`---`は含めたままでよい（前処理が除く）。ファイル名は任意で、`<editedSource>/index.json`の`file`に登録した名前で読む。`<editedSource>/index.json`の`id`・`file`と`data/index.json`の`anonymization.edited`は、差し替えに合わせてエージェントが更新する。

## 生成順序と依存関係

同じシリーズの中で原稿・お手本記事を差し替える、または編集対象のスコープ分割（件数・区切り）を変えるときは、`source/`配下の原資料ディレクトリを入れ替え、編集対象なら`<editedSource>/index.json`も実態に合わせたうえで（お手本は一覧を持たず、ディレクトリの`.md`をそのまま読む）、次の順に再実行する。差し替えていない媒体のプロファイルと実例集・書き方シート・統合文書は、`extract verify`のSHA-256照合をそのまま通るので作り直さなくてよい。編集対象を差し替えると、公開済みの`diff_dataN.json`は原文のSHA-256が新しい原稿と一致しなくなり、画面はエラーで止まる（旧変更案が新原稿の上に表示されることはない）。3の再公開を全スコープで終えるまで画面は表示できず、`candidatesN.json`もオフセットと`before`が新原稿と合わないため書き直しになる。`finding_texts.json`だけは原文のハッシュを持たず、旧内容のままでも画面は止まらないので、差し替え時は4を必ず実施し、全スコープ×4観点のエントリすべてを書き直す。スコープを減らした場合、消えたスコープの`report`はmicroCMSに残るので、5の送信で消す。

1. extract：原資料ディレクトリ（お手本・編集対象）を読み、`data/<seriesKey>/profiles/`配下の`stylometric_profile.json`一式（お手本1＋編集対象全体1＋スコープ別）を`bun run scripts/extract.ts prepare --series <seriesKey> [--check]`が生成する。続けてagentが実例集・書き方シート・統合文書を書き（[抽出処理](./extraction.md)のagentの工程）、`bun run scripts/extract.ts verify --series <seriesKey>`が検査する
2. build-report：プロファイルを読み、`comparison_data*.json`を生成し、続けてそれを読んで`overview_criteria.json`を生成する
3. スコープごとにrevision.tsのprepare→(agent候補)→evaluate→publishが`planN.json`→`candidatesN.json`→`evaluationN.json`→`diff_dataN.json`の順に生成する。build-chapter-diffsは全スコープのpublish（`--check`時はpublish --check）をまとめて実行する
4. `finding_texts.json`を手作業／agentで更新（2・3の結果を読んで書く。生成スクリプトは書き換えない）
5. `scripts/cms.ts push --series <seriesKey>`で、microCMSに登録済みの同じ`seriesKey`のシリーズへ送る。画面（`src/app/[seriesKey]/page.tsx`）は上記のローカルファイルを直接読まず、パスの`seriesKey`のシリーズとその`report`（`getSeriesByKey`・`getReportList`、[microCMS連携仕様](../spec/microcms.md)参照）をリクエストのたびに取得し、`buildReportModel`でレポート本体を描画する。`overview_criteria.json`は読まず、`computeOverviewCriteria`でリクエストごとに再計算する。静的HTML生成ステップはない

## 公開環境への送信

画面が読むmicroCMSの内容は、`scripts/cms.ts push`がローカルの成果物から組み立てて、引数`--series`の`seriesKey`が指す、microCMSに登録済みのシリーズへ書き込む（`series`は書かず、無ければ止まる）。表示名は送らない。入力は合成済み設定（`config/report.json`・`data/index.json`・`<editedSource>/index.json`）・`data/<seriesKey>/report/comparison_data*.json`・`data/<seriesKey>/report/diff_dataN.json`・`source/`の原稿（原文・改稿のSHA-256検証用）で、`profiles/`・`propose/`は読まない。個別スコープの変更案材料（本文・理由行・再測定指標）は`scopeReportMaterial`（`src/app/_parts/model/scope-proposal.ts`）が原文・改稿のハッシュと`editList[].before`を検証してから組み立て、1件でも不一致があれば1件も送信しない。総評は`scripts/cms.ts import-findings`が`data/<seriesKey>/report/finding_texts.json`（またはそれと同じ形のファイル）を読み、microCMSの`findingList`フィールドだけを書く。フィールド定義・各コマンドの挙動は[microCMS連携仕様](../spec/microcms.md)を参照。

## 整合性に使うハッシュ・バージョンフィールド

- 各`stylometric_profile.json`の`meta.sourceFileList[].sha256`：計測に使った各文書ファイルのSHA-256（`sourceRef`・`path`とペアで記録する）
- `overview_criteria.json`の`sourceList[].sha256`：参照した`comparison_data*.json`各ファイルのSHA-256
- `planN.json`・`diff_dataN.json`の`sourceHashList`：そのスコープの原資料ファイル・お手本プロファイル・スコーププロファイル・実例集・書き方シート・`overview_criteria.json`・該当`comparison_dataN.json`・計測モジュール・LSM/敬語辞書一式・設定ファイル（`config/report.json`）のSHA-256をまとめたマップ。`chapter-revision-4`の`prepare`/`evaluate`/`publish`はこれを現在の入力から再計算した値と照合する
- `diff_dataN.json`の`originalTextSha256`/`revisedTextSha256`：原文・改稿全文のSHA-256。apply-to-manuscriptはこの値で書き戻し結果を検証する
- `diff_dataN.json`の`version`：`chapter-revision-4`。他の値は受け付けない
- `overview_criteria.json`の`policy.version`：判定規則のバージョン（`overview-3`）。ルールを変えたら値も変える

## tools/find-cliche/

英語の慣用句・比喩・定型表現の直訳を検出するPythonのツール。このリポジトリでは実行できない（下記「出力」参照）。保存済みの検出結果と生成物（`data/<seriesKey>/find-cliche/`配下）はそのまま読める。検出の考え方と判定パターンは`tools/find-cliche/README.md`・`patterns.md`にある。生成器が動かないため、原稿を差し替えても結果は再生成されず、生成時の原稿に対する結果として残る。

- **目的**：AI補助で書かれた本文に残る、英語圏の定型表現に由来すると推定される文を検出し、言い換え案を添える。採否は人が決め、選ばれた項目だけを原稿へ反映する。
- **入力**：原稿（編集対象媒体の原資料）から作成したスコープごとの英訳（`data/<seriesKey>/find-cliche/translations/*.jsonl`）、その英訳を判定したスコープごとの中間成果物（`data/<seriesKey>/find-cliche/detections/*.md`。該当スコープ「高く該当」「該当」ごとに原文・対応する英語の定型表現・代替案を記録）。
- **出力**：`data/<seriesKey>/find-cliche/find-cliche.html`（人が読んで採用項目を選ぶ一覧）と`data/<seriesKey>/find-cliche/find-cliche.jsonl`（採用IDに対応する`source`/`translation`/`proposal`を1行1JSONで持つ、原稿反映用データ）。生成は`build_find_cliche.py --series <seriesKey>`（`INDEX_HTML`が指すレンダリング済みレポートページからCSSトークン・基本ルール・書体の`<link>`・faviconを読み取り、`find-cliche.html`の見た目に流用する）。このリポジトリにはレンダリング済みレポートページのファイルが存在しないため、`build_find_cliche.py`はそのままでは動かない。
