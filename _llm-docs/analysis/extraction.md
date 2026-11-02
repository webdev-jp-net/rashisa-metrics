# 抽出処理

原資料ディレクトリ（お手本媒体・編集対象媒体それぞれの生の文書一式）から、文体プロファイル・実例集・書き方シート・統合文書を作る一連の処理。CLIは`scripts/extract.ts`（`prepare [--check]`／`verify`。引数`--series <seriesKey>`で作業対象のシリーズを選ぶ）、ライブラリは`src/lib/extract/`に置く。計測条件・プロファイルJSONの各指標フィールドの定義は[計測仕様](./measurement.md)を参照する。

## 入力

原資料ディレクトリは媒体ごとに1つ、`data/index.json`の`modelSource`（お手本）と`editedSource`（編集対象）が指す。中身は1文書＝1つの`.md`ファイルで、お手本は1記事1ファイル、編集対象は1スコープ1ファイル。どの記事をお手本にするか、編集対象の原稿をどう分割するかは抽出処理の外で用意し、抽出処理はディレクトリにある文書をそのまま読む。

## 文書の前処理

各文書の全文は`chapterSource`（[計測仕様の文書の前処理](./measurement.md#文書の前処理)）で前処理してから計測する。両媒体に同じ前処理を適用する。

## `extract prepare [--check]`

1. 設定を読み、お手本・編集対象の原資料ディレクトリを列挙する。編集対象は`<editedSource>/index.json`の各スコープの`file`をスコープid昇順、お手本はファイル名昇順。
2. 各文書を前処理し、媒体の匿名化設定（`anonymization.model`／`anonymization.edited`）で`clean`して計測する。対象はお手本全体（全文書をまとめて計測）、編集対象全体（全文書をまとめて計測）、`<editedSource>/index.json`にある各スコープ（1文書ずつ計測）。
3. `--check`を指定すると、保存済みプロファイルと指標を突き合わせて差分を報告し、ファイルへは書き込まない。指定が無ければ各計測対象の`stylometric_profile.json`を書く。

実例集・書き方シート・統合文書の作成は、後述のagentの工程で行う。

## プロファイルの`meta`

各`stylometric_profile.json`の`meta`は次のフィールドだけを持つ（[プロファイルJSONの形状](./measurement.md#プロファイルjsonの形状)の`meta`の実体）。

| フィールド          | 内容                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `register`          | プロファイルディレクトリ名（`model`・`edited`・`scope<N>`。Nはスコープid）                              |
| `corpusSize`        | 計測対象のコーパス規模                                                                                  |
| `textState`         | `sanitized`固定                                                                                         |
| `measurement`       | 計測条件（[計測メタデータ](./measurement.md#計測メタデータ)）                                           |
| `schemaVersion`     | 計測結果の`schemaVersion`と同じ値。`revision.ts prepare`の`baselineCheck`が再計測結果との一致を検査する |
| `sourceDir`         | 原資料ディレクトリの相対パス                                                                            |
| `sourceFileList`    | 計測に使った文書の`[{sourceRef, path, sha256}]`。計測に使った順                                         |
| `preprocessingRule` | 文書の前処理規則の識別子（`markdown-document-v1`）                                                      |

## agentの工程

`extract prepare`が完了したあと、お手本・編集対象それぞれの`data/<seriesKey>/profiles/<媒体のプロファイルディレクトリ>/`（`model`・`edited`）に、agentが原資料ディレクトリと文体プロファイルだけを根拠に次の3成果物を書く。

- `exemplar_bank.jsonl`：1行1実例。文書の連続した抜粋（前処理後の本文と一致する部分文字列）を使い、`id`・`text`・`chars`（`text`のコードポイント数）・`tagList`・`structureNote`・`sourceRef`・`quality`（`gold`＝単独で書き手の運びが完結／`silver`＝運びの一部）を記録する。
- `expert_synthesis.md`：見出しごとに観察と根拠（`sourceRef`または実例id）を記す。末尾に「観察範囲外」を置く。
- `author_writing_sheet.md`：観点ごとに本人の書き方と根拠（実例id／`sourceRef`）を並べた表。「LLMデフォルト」列は任意。

## `extract verify`

両媒体について次を検査し、1件でも不合格なら一覧を出して`exit 1`する。

- プロファイルの`sourceFileList`のSHA-256が現在の原資料と一致する。
- 実例集が非空で`id`が一意である。
- 各実例の`sourceRef`がプロファイルの`sourceFileList[].sourceRef`に存在し、`text`が非空でその文書（前処理後）の部分文字列で、匿名化`termList`を含まず、`chars`が一致し、`quality`が`gold`か`silver`で、`tagList`が配列、`structureNote`が非空である。
- 書き方シート・統合文書が非空で、実在する`sourceRef`か実例idを1つ以上引用している。

## 持たないもの

抽出処理は次を持たない。

- 対比例（採用案と不採用案を対にした成果物）
- 評価用に保留する記事、およびその評価手順
- 抽出記録（選定件数・除外理由などの経過記録）
- スコープ別ディレクトリへの実例集・書き方シート・統合文書の配置。全体版に`sourceRef`が付くため、スコープ別の複製は作らない
