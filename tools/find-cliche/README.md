# find-cliche

編集対象媒体の本文に混ざる、英語の慣用句・比喩・定型を直訳したと推定される表現を検出するための作業領域。

## 目的

AI補助で書かれた本文に現れる、英語圏の定型表現に由来する可能性がある文を見つけ、言い換え案を添える。

案を全部適用することはしない。編集者または著者が採用する項目をidで選び、選ばれたidだけをAIが原稿へ反映する。検出と提案はその材料であり、採否は人が決める。

## 判定

日本語の文を自然に英訳し、その英文が英語の慣用句・クリシェ・比喩・定型にきれいに戻るかだけで判定する。

- 日本語として自然かどうかは判定しない。
- 文体比較や他のフィルターは混ぜない。
- 候補数を成果とみなさない。該当なしも正当な結果とする。

判定は次の3区分を使う。

- **高く該当**: 特定の英語定型に、文の構造や比喩まで明瞭に対応する。
- **該当**: 英語定型との対応を示せるが、表現や構造の一部にずれがある。
- **該当しない**: 英語定型への対応が認められない。

出力では「高く該当」と「該当」の文だけを列挙する。

検出した文には、必要に応じて定型感を避けた日本語の代替案を添える。代替案は原文の意味と前後の流れを保ちながら、日本語として自然に言い換える。文の役割が重複している場合は、削除案を示してもよい。英訳を再作成したり、原文を機械的に逐語変換したりせず、編集時に比較できる簡素な案を提示する。

## 判定結果の保存

章ごとの判定は `data/<seriesKey>/find-cliche/detections/{章番号}-{slug}.md` に保存する。章番号とslugは英訳ファイルと同じ。

成果物は`data/<seriesKey>/find-cliche/`にシリーズごとに置く。最終成果物は2つ。人が読んで採用する項目を選ぶ `data/<seriesKey>/find-cliche/find-cliche.html` と、選ばれた項目を原稿へ反映するAIに渡す `data/<seriesKey>/find-cliche/find-cliche.jsonl`。どちらも `build_find_cliche.py` が全章の中間成果物から生成する。中間成果物を作る担当者は、自分の章のMarkdownだけを編集する。

```md
# おわりに

## 高く該当

- [20990101-09-01] これから先も、一歩ずつ着実に進んでいきましょう。  
  → *step by step* に対応。
  → 代替案: これから先も、着実に進めていきます。

## 該当

- [20990101-09-02] 扉を開けば、新しい景色が広がっています。  
  → *open the door* に対応。ただし文全体では、扉の比喩に複数の表現を重ねている。
```

該当する文がない章は、章見出しの下に「該当なし」と記録する。

### 保存済み英訳の判定手順

1. [patterns.md](patterns.md) を読み、英語の型の参照例を把握する。
2. 対象章の `data/<seriesKey>/find-cliche/translations/*.jsonl` を読み、保存された `translation` と `source` の対応を確認しながら、文ごとに判定する。照合のために再英訳したり、保存済み英訳を定型へ寄せて書き換えたりしない。
3. 「高く該当」「該当」の原文を、担当章の `data/<seriesKey>/find-cliche/detections/*.md` へ簡素な箇条書きで記録する。各項目の先頭に `[id]` を付し、保存済み英訳と、必要に応じて日本語の代替案（または削除案）を添える。該当文がなければ「該当なし」とする。
4. `python3 build_find_cliche.py --series <seriesKey>` を実行し、`data/<seriesKey>/find-cliche/find-cliche.html` と `data/<seriesKey>/find-cliche/find-cliche.jsonl` を生成する。

判定では、英訳の単語の一致だけでなく、文がどのような構造・比喩・語り方の型で語られているかを見る。語彙が異なっていても、対応する英語定型と共通する型を具体的に示せるか確認する。たとえば `the answer lies in…` に対して、保存済み英訳が `the answer exists in…` であっても、「答えがどこにあるかを示す」という構造と文中の意味を照合する。

パターンリストは手がかりであり、検出範囲を限定しない。載っていない型も対象にする。短い語句の一致や、単に英語でよく言いそうという印象だけでは該当としない。判定区分は英語定型への対応の確かさを示し、日本語の違和感や修正の必要性は評価しない。

### id

`{版}-{章番号}-{通し番号}`。版は原稿ファイル名（`data/index.json` の `editedSource` 直下の `index.json` の `file` が指すファイル）の日付部分、章番号は `data/<seriesKey>/find-cliche/detections/*.md` のファイル名先頭2桁、通し番号は章内で「高く該当」→「該当」の順に `01` から振る2桁連番。同じ原文が章内に複数あっても、出現順に別のidを振る。

### build_find_cliche.py

`data/<seriesKey>/find-cliche/detections/*.md` を読み、`data/<seriesKey>/find-cliche/find-cliche.html` と `data/<seriesKey>/find-cliche/find-cliche.jsonl` を書く。引数`--series`で対象のシリーズ（`data/index.json`の`seriesKey`）を指定する。章番号も渡すとその章だけのHTMLを書く（叩き用。jsonlは書かない）。デザイントークン・基本スタイル・faviconは実行時に `../index.html` から取り出すので、お手本が変われば追随する。

### find-cliche.html

中間成果物の全項目を章番号順に、id・判定区分・英語定型・ずれの説明・代替案（または削除案）つきで載せる。

### find-cliche.jsonl

原稿へ反映するAIに、採用するidの一覧と一緒に渡す。AIは一覧にあるidの `source` を原稿から探し、`proposal` に置き換える（空文字なら文を削除する）。`data/<seriesKey>/find-cliche/detections/*.md` の全項目を章番号順・id順に1行1JSONで並べる。判定区分・英語定型・ずれの説明は含めない。

```json
{"id": "20990101-05-03", "chapter": 5, "source": "新しい習慣を始めるための第一歩は、思っている以上にシンプルです。", "translation": "The first step toward starting a new habit is simpler than you might think.", "proposal": "新しい習慣を始める第一歩に、特別な準備は要りません。"}
```

- `chapter`: idの章番号を整数にする。
- `translation`: 同じ章の `data/<seriesKey>/find-cliche/translations/*.jsonl` で `source` が完全一致する行から写す。複数あれば出現順に対応づける。一致がなければ `data/<seriesKey>/find-cliche/detections/*.md` の原文の転記ミスなので、そちらを直す。
- `proposal`: 削除案は空文字 `""`。代替案の末尾に（ ）で添えた補足は含めない。

行数は `data/<seriesKey>/find-cliche/detections/*.md` の項目総数と一致させる。

## 英訳を作る手順

原稿の正本は、`data/index.json` の `editedSource` が指すディレクトリにある、`<editedSource>/index.json` の `file` のファイル。

章は原稿の `## ` 見出しで区切る。見出し行から次の `## ` 見出しの直前までを1章とし、出現順に `00` から2桁の章番号を振る。ファイル名は `data/<seriesKey>/find-cliche/translations/{章番号}-{slug}.jsonl`。slugは「はじめに」を `preface`、「第N章」を `chapter-N`、「おわりに」を `closing` とする。

見出し（`#`で始まる行）と区切り線（`---`）は英訳しない。本文を文単位で分け、各文につき1行のJSONを記録する。引用符の内側の句点など、文が終わらない句点で分割しない。

各JSON行は次の形にする。

```json
{"sourceLineStart": 9, "sourceLineEnd": 9, "source": "自分の身体を変えたい。", "translation": "I want to change my body."}
```

- `sourceLineStart` と `sourceLineEnd` は原稿の物理行番号。
- `source` は原稿の文をそのまま保存する。表記・句読点を直さない。
- `translation` は、その文だけを自然な英語に素直に訳す。

英語の定型、慣用句、クリシェへ意図して寄せない。原文にない情報を補ったり、複数文を統合・要約したりしない。後続の検出では、この最初の英訳を固定して使う。

英訳を作る段階では、`高く該当`・`該当`・`該当しない`の判定を加えない。判定は英訳がそろった後の別工程で行う。
