# 章単位編集案

1スコープの全文を4観点・26指標で読み、お手本媒体に近づける編集候補をagentが探索し、実計測と全文レビューを通過したものだけを既存のdiff表示へ渡す仕様。版は`chapter-revision-4`。原文お手本と編集対象原稿の事実・意味・引用は不変とする。実装は`src/lib/revision/`（指標仕様・budget算出・候補適用・評価・公開データ組み立て・説明文検査）に置き、CLIは`scripts/revision.ts`（`prepare`/`evaluate`/`publish`/`refresh-copy`、`bun run scripts/revision.ts <prepare|evaluate|publish|refresh-copy> --scope N --series <seriesKey>`の形。`--check`は`publish`だけが受け付ける）に置く。

この仕様は`<editedSource>/index.json`にある全スコープに適用する。`diff_dataN.json`の`version`は`chapter-revision-4`で、他の値を持つファイルは表示・再生成のどちらも受け付けず、版名を示すエラーで停止する。

## 固定ワークフロー

```
revision.ts prepare --scope N
  → planN.jsonを作成
  → agent: 対象範囲の全blockを全targetで読解し、編集・レビューを一周して候補JSON（candidatesN.json）へまとめて反映
  → proposal-text（reader-copy検査）で表示文を検査し、指摘があれば説明・副作用だけ修正して再検査
  → 候補を変更したスコープの古いfinalReviewを外す
revision.ts evaluate --scope N
  → agent: revised textを全文再読。追加修正があれば一周分をまとめて再評価し、finalReviewを記録
revision.ts publish --scope N
revision.ts publish --scope N --check
```

`publish`はプロファイルを変えないため、公開後に`build-report`を再実行する必要はない。既存の候補を捨てて作り直す場合も同じ手順で、`prepare`のあとに新しい`candidatesN.json`を書く。

再計算は対象範囲の編集・レビューを一周してから、変更したスコープごとに実行する。1箇所修正するたびには実行しない。説明・副作用だけの変更は`refresh-copy`を使う（下記）。複数スコープの依頼では、対象スコープすべてを一周してから、変更したスコープだけ`evaluate`する。対象外のスコープはこの工程に含めない。

計測・判定・評価はAI呼び出しを行わない決定的な処理である。候補探索、全文の読解、意味・事実・引用・語調の確認、`finalReview`の記録はagentが行う工程で、実装側からAI APIは呼ばない。

### 再計算のタイミング

1. 各変更案を読み、採用・不採用・差し替えをまとめて判断する。不採用候補は候補配列から外す。差し替えは該当候補を更新する。
2. 候補を変更したスコープの古い`finalReview`を外す。編集途中では`evaluate`、再評価を伴う`publish`・`publish --check`・`build-chapter-diffs`は実行しない。
3. 対象範囲を一周したら、変更した各スコープで`evaluate`を一度実行する。初回生成では候補を作成した各スコープが対象になる。
4. 改稿全文を通読する。追加修正が必要ならそのレビュー対象範囲を一周して修正をまとめ、変更したスコープだけ再評価する。問題がなければ`finalReview`を記録し、公開工程へ進む。

実行タイミングはagentがこの手順に従って制御する。候補JSONの保存自体は再計算を起動しない。

## 対象・探索・採用

- 対象は`planN.json`の26指標のうち`standout: true`の全target。
- 候補探索範囲はスコープ全文の全block。各targetにつき候補は0件以上、複数件でよい。適用範囲が重なる別案は評価前に一つに絞る（範囲が重複したまま計測に進むと停止する）。
- targetの提示順は、お手本との差の大きさ（差の絶対値をその項目の許容幅で割った値）が大きい順。
- 評価はレビュー済み候補を全件まとめて適用し、原稿と改稿全文を各1回計測する。単独候補ごとの計測、全ペアの総当たり、採用の反復探索は行わない。

### budget

budgetは候補探索の目安値で、採用量は実計測で決める。各targetについて、現在値とお手本値の差（`gap`）と増減方向（`direction`：`increase`/`decrease`/`none`）を出す。比率・密度系の指標（LSM文法語カテゴリ、文末表現、敬語密度）は分子・分母の実カウント（`numerator`/`denominator`）から、お手本値に到達するために必要な分子の目標値（`targetCountAtCurrentDenominator` = お手本の比率 × 現在の分母 ÷ スケール）と、そこまでの差分件数（`estimatedDeltaCount` = 目標 − 現在の分子）を出す。文長・段落長のような分布指標は分子・分母を持たないため、これらは`null`。budgetはあくまで探索の目安であり、採用量は実計測で決める。

### 採用しない場合

一括適用結果に対して次を確認し、該当があれば公開を止める。

| 確認事項                                        | 内容                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| overshoot                                       | 対象targetがお手本値をまたいで反対側へ超過して動いた                                                 |
| targetRegression（既存targetの悪化）            | 対象targetの、お手本値との差の絶対値が適用前より大きくなった                                         |
| newStandout（非対象targetの新規standout）       | 対象外の指標が新たに強調（standout）の許容幅を超えた                                                 |
| noImprovement（改善なし）                       | チェック対象のstandout targetのうち、改善したものが1件もない                                         |
| declaredTargetNotImproved（宣言targetの未改善） | 適用した候補が宣言した`targetList`のうち、改善したものが1件もない                                    |
| denominatorOnly（分母だけの変化）               | 対象カウントの分子の増減方向が、お手本へ寄せる方向と一致していない（分母の変化だけで比率が改善した） |

`noImprovement`はチェック対象のstandout target全体を基準に、`declaredTargetNotImproved`は候補が宣言したtargetを基準にする点が異なる。対象外のstandout targetの悪化（`protectedTargetList`に含まれないtargetの悪化）は妨げない。他candidateの副作用で埋めがたい指標が動くことを許容する。比率指標は分母の変化だけで改善した候補を拒否する。中央値は段落分け・段落構成をまとめて計測するため、実測値で判断する。評価器は候補を自動で間引かない。確認事項があれば候補JSONをまとめて見直し、再評価する。

targetを完全一致できない場合も、表現を壊してまで寄せない。targetReviewListに、粒度の限界・他条件との結合・表現保持などの結論をtargetごとに残す。

## agentの読み方

数量表現の同義語への言い換えを「数量詞削減」としない。「かもしれない／かもしれません」の推量表現を「否定削減」のために差し替えない。判定は[計測仕様のLSMカテゴリ判定](./measurement.md#lsmカテゴリ)に集約し、抽出時の割合と候補評価時の出現数で同じ定義を使う。

候補を書く前に、各blockを全targetと照合する。候補の理由は数値だけでなく、本文の意味・事実・引用・読み手への効果を確認して書く。お手本の例文は既存の実例集のIDで参照し、原文お手本自体は書き換えない。候補適用検査（`validateReview`）は、候補が数字と既存の「」『』引用を変えていないことを機械的に確認する。

候補保存後の候補適用・計測・評価は入力とJSONが同じなら再現する。一方、全文を読んで候補を発見し、自然さ・意味・語調を判断する読解工程は再現性のある数値処理とは別物であり、同じ候補が再生成される保証はない。

## 入力ハッシュ照合

`prepare`は、そのスコープの原資料ファイル・お手本プロファイル・対象スコーププロファイル・実例集・書き方シート・`overview_criteria.json`・そのスコープの`comparison_dataN.json`・計測モジュール本体・LSM/敬語辞書のYAML一式・設定ファイル（`config/report.json`）のSHA-256をまとめて`sourceHashList`としてplanに記録する。

`evaluate`/`publish`実行時は、保存済みplanの`sourceHashList`を現在の入力から再計算した値と照合する。そのスコープの原資料ファイル・お手本・計測定義のいずれかが変わっていれば一致せず、その時点で停止する。停止した場合は`prepare`からやり直し、候補と改稿全文を読み直す。同様に、planに記録したスコープ本文のSHA-256（`originalSha256`）が現在の前処理結果と一致しない場合も停止する。

## JSON最小スキーマ

### planN.json

| フィールド       | 型            | 内容                                                                                                                |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `version`        | string        | `chapter-revision-4`                                                                                                |
| `section`        | number        | スコープid（`<editedSource>/index.json`の`id`のいずれか）                                                           |
| `label`          | string        | スコープの表示名のプレースホルダー（`{scopeList.label:N}`、Nはスコープid）                                          |
| `sourceHashList` | object        | 入力ファイルの相対パス→SHA-256                                                                                      |
| `sourceFile`     | string        | スコープの原資料ファイル名（`pathList.editedSource`からの相対パス）                                                 |
| `sourceLineList` | array<number> | スコープ内オフセットに対応する、原資料ファイル内の1-based行番号列                                                   |
| `originalSha256` | string        | スコープ本文（前処理後）のSHA-256                                                                                   |
| `blockList`      | array         | スコープ全文をブロック分割した配列。各要素は`id`（`p001`形式の連番）・`start`/`end`（スコープ内オフセット）・`text` |
| `metricList`     | array<26>     | 26指標の仕様（下記`MetricSpec`の形）                                                                                |
| `targetList`     | array         | `metricList`のうち`standout: true`の項目に`budget`を付加したもの。差の大きい順                                      |
| `countList`      | object        | 指標パスごとの実カウント詳細（`numerator`/`denominator`/`occurrence_list`）                                         |
| `modelExamples`  | string        | 実例集ファイルの相対パス                                                                                            |
| `instructions`   | string        | agent向けの固定指示文                                                                                               |

`metricList`各要素（`MetricSpec`、`metricSpecList()`が作る）：`id`/`path`（フィールドパス。同値）・`label`（「群・項目」形式）・`group`・`unit`・`scale`（比率系100、密度・長さ系1）・`model`（お手本の値。比率系は%換算済み）・`before`（現在のスコープの値。同換算）・`limit`（許容幅または閾値）・`standout`（判定規則で強調に該当するか）。

### candidatesN.json

| フィールド         | 型     | 内容                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `candidateList`    | array  | 各要素は`id`（`c001`形式）・`targetList`（対象target IDの配列。standout targetのいずれかを含む）・`start`/`end`（スコープ内オフセット）・`before`/`after`（原文の連続部分と変更後）・`displayReason`（読者向け説明）・`tradeoff`（読者向け副作用）・`modelRefList`（参照した実例集IDの配列）・`isolated`（任意。単独適用時の`model`/`before`/`after`。理由行見出しの方向語の根拠に使う） |
| `targetReviewList` | array  | targetごとに1件。`target`（target ID）・`reason`（スコープ全体を読んだ結論）                                                                                                                                                                                                                                                                                                             |
| `bundleList`       | array  | 複数候補が組み合わさって初めて効果を持つ場合の候補IDの配列（2件以上、重複なし）。検証だけされ、評価は追加計測を行わない                                                                                                                                                                                                                                                                  |
| `finalReview`      | object | `revisedSha256`（全文再読した改稿文のSHA-256）・`verdict`（`approved`）・`reason`（改稿全文を読み、意味・事実・引用・語調を確認した記録）                                                                                                                                                                                                                                                |

`targetReviewList`は`planN.json`の`targetList`と同数・同一ID集合を持たなければならない。`finalReview`は`evaluationN.json`の`revisedSha256`と一致していなければ無効（改稿文が変わると承認も無効になる）。

候補の制約：`before`≠`after`（`after`は空文字列可、非空なら前後空白を除いても非空）。`start`/`end`が指す原文と`before`が一致すること。候補どうしの適用範囲が重ならないこと。数字（全角・半角、小数点含む）の並びを変えないこと。既存の「」『』引用を減らさないこと。

### evaluationN.json

| フィールド        | 型            | 内容                                                                                                                                                                                                                                                                 |
| ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`         | string        | `chapter-revision-4`                                                                                                                                                                                                                                                 |
| `section`         | number        | スコープid                                                                                                                                                                                                                                                           |
| `selected`        | array<string> | 適用した候補IDの配列（オフセット順）                                                                                                                                                                                                                                 |
| `problemList`     | array         | 確認事項（`target`・`reason`のペア。上記「採用しない場合」の表、または`declaredTargetNotImproved`）                                                                                                                                                                  |
| `stepList`        | array         | 適用ステップの記録。候補があれば1件、`added`（適用候補ID配列）・`improved`（改善したtarget ID配列）                                                                                                                                                                  |
| `residualList`    | array         | targetごとの残差。`id`・`status`（`reached`または`preserveExpression`）・budgetの各フィールド（`current`/`model`/`gap`/`direction`/`estimatedDeltaCount`/`targetCountAtCurrentDenominator`/`numerator`/`denominator`）・`reason`（対応する`targetReviewList`の理由） |
| `revisedSha256`   | string        | 改稿全文のSHA-256                                                                                                                                                                                                                                                    |
| `revisedText`     | string        | 改稿全文（公開用の`diff_dataN.json`には含めない）                                                                                                                                                                                                                    |
| `measurementList` | object        | `before`/`after`（原稿・改稿それぞれの計測結果全体）                                                                                                                                                                                                                 |
| `search`          | string        | 探索方法の説明文（固定値：全候補一括適用・1回計測）                                                                                                                                                                                                                  |

`selected`に候補が1件もない場合、`problemList`・`residualList`はそれぞれ空・target分のみとなり、`stepList`は空配列。

### diff_dataN.json

`publish`が生成する公開データ。`revisionStatus: "complete"`のときだけ既存UIに表示される。

| フィールド           | 型        | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`            | string    | `chapter-revision-4`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `revisionStatus`     | string    | `complete`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `section`            | number    | スコープid                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `label`              | string    | スコープの表示名のプレースホルダー（`{scopeList.label:N}`、Nはスコープid）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `sourceFile`         | string    | スコープの原資料ファイル名（`pathList.editedSource`からの相対パス）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `sourceHashList`     | object    | planと同じ入力ハッシュ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `originalTextSha256` | string    | 原文のSHA-256                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `revisedTextSha256`  | string    | 改稿全文のSHA-256（改稿全文自体は含めない）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `editList`           | array     | 採用した各候補。publishは候補（`candidatesN.json`の要素）を`{...candidate}`で丸ごと引き写すため、`isolated`を含む候補側のフィールドは候補JSONが持っていればそのまま残り、持っていなければ付かない（`isolated`は単独適用時の`model`/`before`/`after`。理由行見出しの方向語はこの値から決める。値がない候補では方向語を付けない）。そのうえでpublishが`target`/`metricPath`（採用時に紐づけた指標パス）・`label`（指標の日本語ラベル）・`sourceLine`（スコープの原資料ファイル内の1-based行番号）を追加で付与する。`start`/`end`（スコープ内オフセット）は候補JSON由来 |
| `metricList`         | array<27> | 26指標＋LSM平均の1行。各要素は`path`・`label`・`unit`・`model`・`before`・`after`・`target`（standoutだったか）・`movement`（`縮小`/`拡大`/`同じ`）。27件目（`path: "lsm.mean"`）だけ例外で、`movement`を持たず、`model`は固定で`1`、`target`は常に`false`                                                                                                                                                                                                                                                                                                           |
| `measurementList`    | object    | `before`/`after`の計測結果全体                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `residualList`       | array     | evaluationNと同じ形                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `finalReview`        | object    | 承認記録                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

`editList`の`target`は候補の`targetList`配列の先頭要素に紐づく。スコープ0（はじめに）の`diff_data0.json`は、内容を変えず`preface_diff_data.json`としても複製出力する。

## 表示文（displayReason/tradeoff）の書き方と検査

`displayReason`（説明）は「原稿のどこをどう整えるか」を一文・100字以内で書く。読み方への効果があれば同じ一文に含める。`tradeoff`（副作用）は変更で薄れる意味・強まる語調などを一文・80字以内で書く。表示側が「副作用：」を付けるため接頭辞は書かない。

禁止事項：内部ID（候補ID・実例ID等）、ファイル名、計測処理の説明、候補同士の重複管理への言及を表示文に入れない。「同上」など、別の説明を読まないと分からない書き方も避ける。

`src/lib/revision/reader-copy.ts`の`copyErrorList`/`validateCopy`は、`displayReason`/`tradeoff`それぞれに対して次を検査する。呼び出し元は3か所：CLI（`scripts/proposal-text.ts`）、`refresh-copy`（`src/lib/revision/refresh-copy.ts`）、画面表示直前（`src/app/_parts/model/scope-proposal.ts`）。

- 空文字・空白のみでないか
- 内部ID・内部資料名のパターン（候補ID・実例ID形式の文字列、`modelRefList`等の内部語、ファイル拡張子付きの資料名）を含んでいないか
- 「同上。」「同上」「同じ。」のような、単独では意味が通らない文言でないか

文字数上限（100字/80字）と一文であることは上記の書き方の規則であり、この検査には含まれない。検査に失敗した場合はエラーとし、指摘された候補の説明・副作用だけを書き直して再検査する。

## 説明文だけの更新

`candidatesN.json`の`displayReason`・`tradeoff`だけを修正した場合は、`refresh-copy --scope N`を実行してから公開データ／派生JSONを再構成する。`evaluate`・`publish`・`prepare`の実行や`finalReview`の削除は不要。

`refresh-copy`は公開済み候補の`start`/`end`/`before`/`after`/`targetList`が候補JSONと一致していることを確認したうえで、`displayReason`/`tradeoff`が変わった`editList`だけを更新し、reader-copy検査を通してから公開データへ書き戻す。計測値・採用結果・`finalReview`は保持し、原稿の再計測は行わない。公開済み候補の本文・範囲・対象指標が変わっている場合や候補が削除されている場合は停止する。未採用候補の説明は表示対象外。

## 原稿への書き戻しと検証（apply-to-manuscript）

確定した各スコープの`diff_dataN.json`の`editList`を、そのスコープの原資料ファイルへ書き戻す手順（`scripts/apply-to-manuscript.ts --out <dir>`）。`--out`に編集対象媒体の原資料ディレクトリ（`config.pathList.editedSource`）と同じディレクトリを指定した場合は、何も書き込まずに停止する。

全スコープ（`config.scopeList`をid昇順）について次を行う。

1. 対象スコープの原資料ファイルを読み、前処理した本文と行番号列を得る。各`edit`の`start`/`end`（スコープ内オフセット）を、この行番号列から元ファイルの1行に特定する。1つの`edit`がファイルの複数行にまたがる場合は停止する。
2. その行の見出し記号（あれば）を除いた本文部分だけを対象に、`before`を`after`へ置換する。同一行内に複数の`edit`がある場合は、行内オフセットの逆順に適用して位置ズレを避ける。
3. 見出し記号・`---`区切り・変更のない行はすべて元のまま保つ。

全スコープの置換を終えたら、書き込み前に各スコープの生成結果を前処理し直し、そのSHA-256が対応する`diff_dataN.json`の`revisedTextSha256`と一致するか検証する。1件でも不一致なら、どのスコープも書き込まずに停止する。検証をすべて通過して初めて、`--out`に指定したディレクトリへ、スコープごとに原資料ファイルと同じファイル名で書き込む。

対象スコープと各スコープの原資料ファイル名は`<editedSource>/index.json`の`id`・`file`から読む。原資料ファイルが差し替わったときはこのファイルを更新する。
