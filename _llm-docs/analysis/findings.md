# 見出し付き総評

全体と各個別スコープの4観点（LSM・文末表現・敬語の密度・文・段落の長さ）にある、見出し付きの本文（グラフ・数値表・変更案diff・全体冒頭の総評は含まない）は、microCMSの`report`コンテンツの`findingList`フィールドが正本（[microCMS連携仕様](../spec/microcms.md)参照）。画面（`contentFindingList`、`src/app/_parts/model/report-content.ts`）はmicroCMSから取得した`findingList`を表示するだけで、原稿の再計測だけでは本文は更新されない。

`data/<seriesKey>/report/finding_texts.json`は、総評を書くときの下書き形式。ユーザー・agentがこの形式で書き、`scripts/cms.ts import-findings`が引数`--series`のシリーズの`findingList`へ移す（初回の移行、またはまとめて書き直したときに使う）。管理画面から`findingList`を直接編集することもできる。

## finding_texts.jsonのスキーマ

```json
{
  "all": {
    "lsm": {
      "heading": "見出し",
      "paragraphList": ["同じテーマの文です。説明が続きます。", "別のテーマの文です。"],
      "evidence": [
        { "itemList": ["文法語・終助詞"], "exemplarList": ["ex_008"] },
        { "itemList": [], "exemplarList": ["ex_001"] }
      ]
    }
  }
}
```

スコープキーは`"all"`（全体）と、`<editedSource>/index.json`の`id`を文字列にしたもの、観点キーは`"lsm"`・`"endings"`・`"politeness"`・`"length"`の4件。全スコープ×4観点のエントリすべてが必須。いずれかが欠けている場合はどこが欠けているかを示すエラーで生成を止め、固定文へのフォールバックはしない。

各エントリのフィールド：

| フィールド      | 型            | 内容                                                                                                                                                                        |
| --------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading`       | string        | 見出しの文字列                                                                                                                                                              |
| `paragraphList` | array<string> | 意味のまとまりごとに分けた文章。表示はこの配列の順にそのまま並べる                                                                                                          |
| `evidence`      | array         | `paragraphList`と同じ長さの配列。各要素は`itemList`（根拠にした`overview_criteria.json`の`columnList`の「群・項目」名の配列）と`exemplarList`（根拠にした実例集のIDの配列） |

表示側（`FindingText`コンポーネント）は`heading`と`paragraphList`の2項目だけを読み、他のキーが増えても無視する。`evidence`は執筆時の根拠管理に使い、画面表示はしない。`import-findings`はこの`evidence`を、microCMSの`evidenceItemList`・`evidenceExemplarList`（1行1件のテキストエリア）へ書き込む際、段落をまたいで1つの一覧に平坦化する（`paragraphList`との対応関係は残らない、根拠の記録用の値）。

## レンダリング規則

- 値はプレーンテキストとして扱い、HTMLへ出力する際は文字参照エスケープする。
- 各段落は「。」で文に分割し、文と文のあいだに改行を挿入する。段落の最後の文の後ろには改行を入れない。
- 「。」の分割は「」『』（）の内側では行わない（深さカウントで判定する。開き括弧で深さ+1、閉じ括弧で深さ-1、深さ0のときの「。」だけを分割点にする）。引用の途中で文が切れず、「。」に続く閉じ括弧は直前の文側に残る。
- 段落内の「」で囲まれた引用のうち、最外側の対だけを`<q>`要素で囲んで表示する（内側にネストした「」がある場合はネスト部分を個別にマークしない）。『』は`<q>`化の対象にしない。`<q>`要素は本文と異なる色（お手本側の系列色）で表示する。

## 執筆時の入力

総評の見出しと段落は、microCMSの管理画面で`findingList`を直接編集するか、`data/<seriesKey>/report/finding_texts.json`をこの形式で編集して`scripts/cms.ts import-findings`で書き込む。書く前後で`overview_criteria.json`・`comparison_data*.json`を現在の原稿に合わせて再生成しておく（[`data-layout.md`](./data-layout.md)の生成順を参照）。

入力に使えるのは次の既存成果物だけで、原稿・実例集以外の新規調査は行わない。

- **どの指標で差があるか**：`overview_criteria.json`の`columnList`（スコープの添字は`labelList`の順。`flaggedRowList`に含まれるスコープがその項目の許容幅超過、`valueList`の符号が正なら編集対象がお手本より大きい）、`commentList`（スコープごとの超過項目と方向）、`summary`（近さを保てている章・優先章・全スコープ共通の調整）。観点との対応は、文法語・LSM平均→`lsm`、文末→`endings`、丁寧度→`politeness`、文長・段落長→`length`。
- **差が読み口にどう表れるか**：`config.pathList.editedProfile`が指すディレクトリ（編集対象、全体）と`config.pathList.modelProfile`が指すディレクトリ（お手本）の`author_writing_sheet.md`・`expert_synthesis.md`・`exemplar_bank.jsonl`。

## 書き方

- 見出しは、その比較で実際に確認できた主要な特徴を表す。差が小さければ近さを伝える見出しにする。
- 本文は数値の列挙を繰り返さず、違いが読み口にどう表れるかを説明する。具体的な解釈は実例で裏付ける。
- 同じ論点の説明・例示・根拠は一段落にまとめ、別の論点で段落を分ける。
- 各段落の根拠を`evidence`に残す（`paragraphList`と同じ長さ、対応する要素が根拠を持つ）。
- スコープはお手本とだけ比較し、他スコープとの順位は書かない。方向は`valueList`の符号に従い、しきい値超過でない項目を差として書かない。
