# デザイン規約

デザイントークンと、要素ファミリーごとの見た目の規則。SCSS Modules・CSSカスタムプロパティで実装する。

> トークンの実際の値は`src/styles/index.scss`の`:root`（`tokens`レイヤー）が正本。

## 色

### 色相・紙

| トークン       | 用途                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `--hue-paper`  | 紙色・粒子(grain)のoklch色相                                                                                |
| `--paper-l`    | 紙色のoklch明度                                                                                             |
| `--paper-c`    | 紙色のoklch彩度                                                                                             |
| `--paper`      | `body`の背景色                                                                                              |
| `--paper-card` | カード状の面（`.chart`・`ViewpointCard`の`.card`・`table`・`.diffbox`のtd以外の既定背景等）の背景色。半透明 |

### 藍

| トークン  | 用途                                                                               |
| --------- | ---------------------------------------------------------------------------------- |
| `--ink-1` | 最も濃い文字色。`body`地色、見出し(`h1`/`h3`)、選択中タブ文字、フォーカスリング等  |
| `--ink-2` | リンク色、タブ未選択文字、系列b（編集対象媒体）のバー色、スコープリンクの点(dot)色 |
| `--ink-3` | 比較テーブルの強調行罫線                                                           |
| `--ink-4` | タブhover時の下線色                                                                |

### 罫線・影

| トークン         | 用途                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `--rule`         | 図版のグリッド線・水平線(`hr`)のグラデーション両端                                           |
| `--rule-soft`    | カード状要素（`.chart`・`ViewpointCard`の`.card`）の枠線                                     |
| `--rule-neutral` | テーブルセルの下罫線                                                                         |
| `--shadow-card`  | カード状要素（`.chart`・`ViewpointCard`の`.card`・stuck時の`ScopeNav`の`.bar`）の3層シャドウ |

### 強調用の面色

| トークン   | 用途                                              |
| ---------- | ------------------------------------------------- |
| `--tint-2` | 比較テーブルの`td.standout`（基準超過セル）の背景 |

### 系列色

| トークン        | 用途                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------- |
| `--sepia-l`     | 系列a色・補足文字色のoklch明度                                                              |
| `--sepia-h`     | 系列a色・補足文字色・LSM図の帯色のoklch色相                                                 |
| `--series-a`    | ペア棒グラフの系列a（お手本媒体）のバー色。`.dot.a`、`.lead`、引用(`<q>`)の文字色にも使用   |
| `--series-b`    | ペア棒グラフの系列b（編集対象媒体）のバー色。`.dot.b`に使用                                 |
| `--ink-desc`    | 補足説明文字色（`small`・`.hint`・`.chip`の凡例文字・軸定義カードの補足・テーブルth文字等） |
| `--paper-sepia` | テーブル`th`の背景、比較テーブルの列見出し背景、LSM図の0.6〜0.85帯の背景                    |

### diff表専用色

| トークン                 | 用途                                                                             |
| ------------------------ | -------------------------------------------------------------------------------- |
| `--diff-border`          | `.diffbox`の外枠、`DiffBox`の`.head`の下罫線                                     |
| `--diff-head-bg`         | `.head`の背景、行番号セル(`td.ln`)の背景、変更なしブランク行(`.blankSide`)の背景 |
| `--diff-head-hover`      | `.head:hover`の背景                                                              |
| `--diff-muted`           | 「すべて展開」ラベル文字色、折りたたみラベル文字色                               |
| `--diff-ln`              | 行番号の文字色                                                                   |
| `--diff-ln-border`       | 行番号セルとコードセルの境界線、折りたたみ行のアイコンセル背景                   |
| `--diff-del`             | 削除側コードセル(`.delSide`)の背景                                               |
| `--diff-ins`             | 追加側コードセル(`.insSide`)の背景                                               |
| `--diff-del-ln`          | 削除側行番号セルの背景                                                           |
| `--diff-ins-ln`          | 追加側行番号セルの背景                                                           |
| `--diff-del-mark`        | 削除側の語レベルハイライト(`.mark`)背景                                          |
| `--diff-ins-mark`        | 追加側の語レベルハイライト背景                                                   |
| `--diff-fold-icon`       | 折りたたみアイコン（縦3点）の色                                                  |
| `--diff-fold-label`      | 折りたたみラベルセルの背景                                                       |
| `--diff-fold-hover`      | 折りたたみラベルセルhover時の背景                                                |
| `--diff-reason-bg`       | 理由行(`.reasonRow`)の背景                                                       |
| `--diff-reason-border`   | 理由行の下罫線、変更行(`tr.chg`)の上罫線                                         |
| `--diff-fold-icon-hover` | 折りたたみアイコンセルhover時の背景                                              |
| `--diff-bg`              | `.diffbox`全体の背景                                                             |

## 書体

| トークン        | 用途                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--font-body`   | 本文（`body`の既定書体）                                                                                                                                                                                            |
| `--font-head`   | 見出し（`h1`・`h3`・`AnalysisPanel`の`.analysisTitle`・`.tabs button`・`.controls button`・`NumberBadge`の`.badge`・`ScopeNav`の`.title`・`.hint`のフォールバック）                                                 |
| `--font-mono`   | 数値表示（テーブルの数値セル、diff図版の目盛・値ラベル、`LsmBeforeAfter`の`.summary dd`、`.metrics`の数値セル）                                                                                                     |
| `--font-system` | `.diffbox`全体の書体                                                                                                                                                                                                |
| `--font-hand`   | 手書き風リンク（`.hint`、`HeroSection.module.scss`／`IntroSection.module.scss`が使う共通の`scroll-hint-link`ミックスイン、`src/styles/_variable/_index.scss`）の書体。フォールバックは`--font-head`の明朝体スタック |

Google Fontsから読み込む書体は`Zen Kaku Gothic New`（400/700）・`Shippori Mincho`（700）・`Zen Kurenaido`・`IBM Plex Mono`（400/600）の4ファミリーで、`<head>`に`fonts.googleapis.com`・`fonts.gstatic.com`への`preconnect`と`<link rel="stylesheet">`を置く。`Zen Kurenaido`は`--font-hand`としてCSSカスタムプロパティ化されており（`:root`、`src/styles/index.scss`）、`style`属性への直書きはない。オフライン時・未接続時は各トークンのフォールバックスタック（Hiragino／Noto Sans JP／Yu Mincho／system-ui等の端末内蔵フォント）で表示する。

`body`に`font-feature-settings:"palt" 0`が指定されており、プロポーショナルメトリクス詰めは無効化されている（`font-size-adjust:from-font`は`body`・見出し・`AnalysisPanel`の`.analysisTitle`に指定）。

## 文字サイズ・行送り

| トークン | 対応する行送りトークン |
| -------- | ---------------------- |
| `--t-xs` | `--lh-xs`              |
| `--t-sm` | `--lh-sm`              |
| `--t-md` | `--lh-md`              |
| `--t-lg` | `--lh-lg`              |
| `--t-h3` | `--lh-h3`              |
| `--t-h2` | `--lh-h2`              |
| `--t-h1` | `--lh-h1`              |

`--t-md`＝`body`の既定文字サイズ。`--lh-md-tight`は`.controls button`にのみ使用。

## 余白

| トークン          | 用途の目安                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `--s1`            | 最小単位。`.chip`/`.list`/`.reasonInline`のgap、`.tabs button`のpadding、`.diffbox`の角丸など                                         |
| `--s2`            | カード内padding・見出し下marginの単位                                                                                                 |
| `--s3`            | セクション内のgap・グリッド外側余白の基準                                                                                             |
| `--s4`            | `AnalysisPanel`の`.axisContent`と`.proposal`の縦gap、`.chart`の上下padding、`IntroSection`の`.columns`の`calc(var(--s4) + var(--s3))` |
| `--s5`            | セクション間・ヒーロー下部の余白                                                                                                      |
| `--gap-hairline`  | 最小の隙間（LSM前後値ブロック内の行間、フォーカスリングのoffset）                                                                     |
| `--pad-cell`      | 通常テーブルセルのpadding                                                                                                             |
| `--pad-cell-wide` | `.metrics`テーブルセルのpadding                                                                                                       |
| `--rule-w-strong` | 強調罫線幅（選択中タブの下線、フォーカスリング、比較テーブル先頭行の下線）                                                            |

## 装飾・モーショントークン

| トークン        | 用途                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| `--noise`       | `body::before`の粒子レイヤーの不透明度                                                 |
| `--blur-max`    | ビューポートセクションのフェード・折りたたみ前の非表示アニメーションで使う最大ぼかし量 |
| `--grain`       | 粒子レイヤーの色                                                                       |
| `--rule-fade`   | `hr`の背景（両端が透明になる水平線）                                                   |
| `--ease-out`    | 通常のトランジションのイージング                                                       |
| `--ease-in-out` | `.hint::after`の充填アニメーションのイージング                                         |

`@layer tokens, base, layout, components, states;`の順にCSSレイヤーを宣言し、上記トークンは`tokens`レイヤーの`:root`にまとめて定義されている。

幅方向のブレークポイント（`min-width`/`max-width`によるメディアクエリ）はこのCSS内に定義がない。メディアクエリは`prefers-reduced-motion`と`print`のみ。

## ページ背景・面

- `body`の背景は`--paper`（紙色）。文字色は`--ink-1`、書体は`--font-body`、文字サイズは`--t-md`
- `body::before`が画面全面に粒子（グレイン）レイヤーを敷く。SVGの`feTurbulence`＋`feColorMatrix`で生成したノイズをdata URIのマスク画像とし、`mix-blend-mode:multiply`・不透明度`--noise`（`.7`）で紙色に乗算合成する。`z-index`は`body::before`が`0`、`main`が`1`（`src/styles/index.scss`）で、粒子レイヤーは本文の下に敷かれる（本文の上に重なるのではない）。240×240pxのタイルを`mask-size`で繰り返す
- `main`は`display:grid`の12colではない独自の列定義（`grid-template-columns:[full-start] minmax(var(--s3),1fr) [content-start] min(100% - 2*var(--s3),1120px) [content-end] minmax(var(--s3),1fr) [full-end]`）で、本文幅の上限は`1120px`、左右の最小余白は`--s3`（32px）。直下の要素は既定で`content`列（本文幅）に入り、`.report`のみ`full`列（全幅）を取ってから内部で`subgrid`により`content`列に戻す（スコープナビだけ全幅の背景を持たせるため）
- カード状の面（`.chart`・`ViewpointCard`の`.card`・`table`・stuck時の`ScopeNav`の`.bar`）は背景`--paper-card`（半透明の紙色）、枠線`--rule-soft`、影`--shadow-card`

## タイポグラフィ・見出し

- `h1`・`h3`は明朝体（`--font-head`）・ウェイト700・字間`.01em`・色`--ink-1`。`h1`はサイズ`--t-h1`（3.5rem/4rem）、`h3`はサイズ`--t-h3`（1.5rem/2rem）
- `AnalysisPanel`の`.analysisTitle`（分析データ見出し、`h2`）は`h1`/`h3`と同じ明朝体・ウェイト700・字間`.01em`だが、サイズは`--t-h2`（2rem/3rem）で個別に指定されている（`h2`要素自体への既定スタイルはない）
- `h4`はサイズ`--t-lg`（1.125rem/2rem）・ウェイト700・本文書体
- リード文（`.lead`）はサイズ`--t-h3`・色`--series-a`（系列aの色を借用）
- 段落（`p`）・強調（`strong`）・リンク（`a`、色`--ink-2`・hoverで`--ink-1`）・水平線（`hr`、`--rule-fade`の背景1px）にそれぞれ既定スタイルがある
- フォーカスリングは全要素共通で`outline:var(--rule-w-strong) solid var(--ink-2)`・`outline-offset:var(--gap-hairline)`（`:focus-visible`）

## 番号バッジ

`NumberBadge`コンポーネント（`src/app/_parts/components/NumberBadge/NumberBadge.tsx`）が`<span class={styles.badge}>01</span>ラベル`（値を2桁ゼロ埋め）の形を生成する。`.badge`（`NumberBadge.module.scss`）は明朝体・ウェイト400・色`--ink-2`・右マージン`--s1`。スコープ切替タブには使わず、観点タブ（`LSM 類似度`／文末表現／敬語の密度／文・段落の長さ）、主要項目と全項目のあいだに並ぶ全体スコープの比較テーブルのフィルターボタン4つ（01〜04）、再測定テーブルのスコープ見出し（`RemeasureTable`の`.colGenre`、観点タブと同じ固定順の番号：LSM=01・文末表現=02・敬語の密度=03・文・段落の長さ=04）の3か所に使う。スコープ見出しに現れるのは、standout（基準超過）指標のうち変更前後の値が実際に動いた（`|after - before| > 1e-12`）観点だけで、対象ではあっても値が動かなかった観点は表に出ない（`src/app/_parts/model/scope-proposal.ts`の`metricListGroupList`）。軸定義カード見出しの数字（`ViewpointCard`の`h3 .num`）は`NumberBadge`を使わない別実装で、明朝体・色`--ink-desc`・右マージン`.5em`。

## アイコン

`Icon`コンポーネント（`src/app/_parts/components/Icon/Icon.tsx`）が、`@phosphor-icons/react/ssr`（Phosphor Icons、MIT）のアイコンをアイコン名で選んで描画する。アイコン用の外部フォントやスプライトファイルは使わない。

- `.icon`は`width:1em;height:1em`・`fill:currentColor`・`vertical-align:-0.125em`で、周囲の文字サイズ・文字色に追従する
- 収録アイコンは5種：`arrow-right`（Light・Regular両方）、`plus`・`minus`・`arrows-in-line-vertical`・`arrows-out-line-vertical`（Regularのみ）
- ウェイトの使い分け：Lightは24px相当（LSM提案前後の矢印、`LsmBeforeAfter`の`.arrow`＝`--t-h3`サイズ）でのみ使用し、それ未満のサイズ（再測定テーブルの矢印列、増減方向のプラス/マイナス、diff折りたたみの展開/収納アイコン）はRegularを使う
- diff折りたたみ行のアイコン（縦3点）はPhosphorではなく個別のインラインSVG（`viewBox="0 0 16 16"`、3つの`<circle>`）

## 軸定義カード

4つの観点（LSM・文末表現・敬語の密度・文・段落の長さ）の定義を1度だけ表示するカード群。`IntroSection`の`.cards`は単列グリッド（`grid-template-columns:1fr`）、カード間`gap:--s2`。各`ViewpointCard`の`.card`は枠線`--rule-soft`・影`--shadow-card`・背景`--paper-card`・padding`--s3`。

カード内訳：

| 観点キー     | 見出し         | サブタイトル                                                 | 本文                                                                                 | 例文                                                          |
| ------------ | -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `lsm`        | LSM            | `Language Style Matching`（`.subtitle`、等幅、通常ウェイト） | 言葉の使い方の類似度を、1にどれだけ近いかで表す指標です。                            | 一例では、同じ人物の発言どうしのゆれはLSM0.95の類似度でした。 |
| `endings`    | 文末表現       | なし                                                         | です・ます、体言止め、だ・である など、文を締めくくる言葉の使用比率です。            | なし                                                          |
| `politeness` | 敬語の密度     | なし                                                         | 同じ文章量あたりの尊敬語・謙譲語・丁寧語の使用量を比較した値です。                   | なし                                                          |
| `length`     | 文・段落の長さ | なし                                                         | 一文・ひと段落あたりの文字数です。値が大きいほど、区切らず続けて書く傾向を示します。 | 現代の文章の一文の長さは平均30〜40字程度とされています。      |

サブタイトルがある場合のみ見出し内に表示し、例文がある場合のみ`.example`段落（サイズ`--t-xs`・色`--ink-desc`）を本文の下に表示する（`endings`/`politeness`はどちらも持たない）。

## スティッキーなスコープ切替ナビ

`ScopeNav`コンポーネント（`src/app/_parts/components/ScopeNav/ScopeNav.tsx`、`ScopeNav.module.scss`）の`.wrap`は`position:sticky;top:0;z-index:10`で全幅（`grid-column:full`）。内側の`.bar`は既定で背景透明・影なし。中の`.tabs`は`max-width:calc(1120px + 2*var(--s3))`のグリッド（左：サイトタイトルリンク、右：スコープボタン列）、padding`24px --s3`。

### 通常状態

stuckでない通常状態では、`.wrap button`（スコープボタン群）は`visibility:hidden;filter:blur(var(--blur-max));opacity:0`で、ページ最上部にいる間はスコープボタンが見えない。

### stuck状態

ページがスクロールしてナビが画面上端に貼り付くと、`useReport`フック（`src/app/_parts/useReport.ts`）内のIntersectionObserverが`stuck`という真偽値のReact stateを更新し、`ScopeNav`がそれを`styles.stuck`として`.wrap`要素へ付与する。`.wrap.stuck .bar`は背景を`linear-gradient(var(--paper-card),var(--paper-card)) var(--paper)`（半透明のカード色を不透明の紙色の上に重ねる）にし、影`--shadow-card`を出す。`.wrap.stuck .bar button`は`visibility:visible;filter:blur(0);opacity:1`に遷移する（`transition-delay:0s`でvisibility変化を即時反映）。

サイトタイトルリンク（`.title`、`#top`へのアンカー）は明朝体・ウェイト700・サイズ`--t-h3`・字間`.04em`で、stuck状態に関わらず常に表示。

## タブ

`.tabs`は下罫線`1px solid var(--ink-1)`を持つflexコンテナ。`.tabs button`は明朝体・ウェイト700・サイズ`--t-lg`・色`--ink-2`・下罫線`--rule-w-strong`（既定は透明）で、`flex:1`により均等幅。hoverで下罫線が`--ink-4`、activeで文字・下罫線が`--ink-1`と`--ink-2`に変化。選択中（`aria-selected=true`）は文字色`--ink-1`・ウェイト700・下罫線`--ink-1`。トランジションは色・下罫線色ともに`.2s var(--ease-out)`。

スコープタブ列（`ScopeNav`の`.list`）は上記`.tabs`とは別クラスで、横方向grid（`grid-auto-flow:column`）・右揃え・列間`24px`。ボタンは通常書体（明朝体でなく`--font-body`）・ウェイト400・色`--ink-2`。選択中（`aria-selected=true`）は文字色`--ink-1`かつ、ボタン下`--s2`位置に6px円形のインジケータ（`::before`、色`--ink-2`）が出現（`transform:scale(1);opacity:1;filter:blur(0)`、`.35s`のトランジション。非選択時は`filter:blur(3px)`）。hoverすると`hint-blur`アニメーション（2秒、文字が一瞬ぼけて戻る）が掛かる。

## ペア棒グラフ

`PairChart`コンポーネント（`src/app/_parts/components/PairChart/PairChart.tsx`、`PairChart.module.scss`）が描く、2系列（お手本／編集対象）のグループ化横棒グラフ。SVG1枚で、共通スケール（0〜指定最大値）に対する棒の長さと、下端の目盛線（最大値を4等分した5点＝0・25%・50%・75%・100%の位置に、その位置に対応する実数値のラベル付き、ラベル色`--series-a`）を描く。各行はラベル（項目名）＋棒2本（系列a・系列b、各高さ16px、gap8px）＋各棒の値ラベル（系列名＋数値＋単位）。図の下に凡例（`.chips`、系列色のドット＋系列名）を表示。

- 系列色は固定順`SERIES_FILL=('var(--series-a)','var(--series-b)')`。お手本媒体が系列a、編集対象媒体が系列bで、色は常にこの順で塗られる
- 初期状態の棒は`rect.bar`に`transform:scaleX(.75);opacity:.75`が掛かっており縮んだ状態。`.chart`が画面内に入ると（後述のIntersectionObserverで`in-view`クラスが付く）`transform:scaleX(1);opacity:1`に遷移する（`1s var(--ease-out)`）。`transform-origin`は`0 50%`（左端基準で伸びる）

## LSMスケールバー

文法カテゴリ別LSM図（`LsmFigure`コンポーネント、`src/app/_parts/components/LsmFigure/LsmFigure.tsx`）。上段に平均値の太い棒（強調、色`--ink-2`）、下段に10カテゴリ内訳の細い棒（色`color-mix(in oklch, var(--ink-2) 50%, transparent)`、上段より薄い）を同一の0〜1スケールに並べる。

- スケール上に3ゾーンの背景帯を敷く：0〜0.6（無色・背景帯なし）、0.6〜0.85（背景`--paper-sepia`・不透明度0.5・ラベル「通常」）、0.85〜1.0（背景`oklch(88% 0.03 var(--sepia-h))`・不透明度0.5・ラベル「近い」）
- 目盛は0・0.6・0.85・1の4点。0・0.6・0.85の3点にゾーンラベル（「離れている」「通常」「近い」）を目盛線の右側に表示（サイズ10px・色`--series-a`・等幅フォント）。1の目盛にはラベルを置かない
- 平均値棒の右に平均値の数値（サイズ`--t-h3`・ウェイト700・色`--ink-1`・等幅フォント）を表示。内訳棒の右にも各カテゴリの値（`.value`サイズ`--t-xs`）を表示
- 図の下に`<details><summary>カテゴリ別の内訳</summary>`で折りたたみ式のテーブル（列：カテゴリ名／お手本媒体の比率／編集対象媒体の比率／LSM。媒体名はラベルから組み立てる）を格納

## テーブル

### 基本テーブル

`table`は`border-collapse:collapse`・背景`--paper-card`・サイズ`--t-sm`・`font-variant-numeric:tabular-nums`。セルは`padding:--pad-cell`・下罫線`--rule-neutral`・右揃え（1列目のみ左揃え）。数値セル（1列目以外）は等幅フォント（`--font-mono`優先）。`th`は背景`--paper-sepia`・ウェイト700・色`--ink-desc`。

### 全体と各スコープのnote比較テーブル

`ComparisonTable`の`.wrap`は横スクロール可能（`overflow:auto`・`max-height:736px`）。`table`は`border-collapse:separate`。`thead th`は`position:sticky;top:0`で行方向に粘着（`z-index:2`）。1列目（`.name`、スコープ名ボタン）と2列目（`.diffcount`、差のある指標数）は列方向にも粘着（`position:sticky;left:0`/`left:112px`、`z-index:1`）、ヘッダー行の同セルは`z-index:3`で最前面。先頭行（全体行）は下罫線`--rule-w-strong`・ウェイト700で他行と区別。

基準超過セルには`.standout`クラス（背景`--tint-2`・色`--ink-1`・ウェイト700）が付く。フィルターボタン（主要項目／`01 LSM 類似度`／`02 文末表現`／`03 敬語の密度`／`04 文・段落の長さ`／全項目）はDOMの`data-*`属性ではなく、`ComparisonTable.tsx`内の`isVisible(view, displayGroup, main)`関数（選択中のフィルタとモデルが持つ`displayGroup`/`main`の値を比較する純粋関数）の戻り値で、列（`<th>`/`<td>`）の`hidden`真偽値プロパティを切り替える。

### 再測定テーブル

`RemeasureTable`コンポーネント（`src/app/_parts/components/RemeasureTable/RemeasureTable.tsx`、`RemeasureTable.module.scss`）が持つ`.metrics`は`table-layout:fixed`・背景`--paper`（カード背景でなく`body`と同じ紙色）・最小幅512px。列構成は`<colgroup>`で`.colGenre`・`.colItem`・値列・矢印列・値列・`.colNote`の6列（`.colGenre`240px・`.colItem`160px・`.colNote`280px、矢印列の幅は`--s3`）。ヘッダー行は6セルで、先頭2セルは空、残り4セルが既存テキスト／→（アイコン）／調整提案／参考とするnoteの指標。`th`（行見出し）はスコープ名（`NumberBadge`付き、rowspanで同一スコープの行をまとめる）と項目名の2段。値の増減方向は`+`/`-`のPhosphorアイコン（矢印列、色`--ink-2`）で示す。

### 増減方向の矢印列

`.metrics .arrow`列は各行の値が増加（`plus`アイコン）・減少（`minus`アイコン）・不変（アイコンなし）かを示す。この列自体は表側で「調整提案が既存テキストよりどちら向きに動いたか」だけを表し、お手本媒体との差の方向は示さない。

## 所見テキスト

`FindingText`コンポーネント（`src/app/_parts/components/FindingText/FindingText.tsx`）の`.finding`ブロックは`h3`見出し＋`.body`（段落の集合）で構成する。文分割・引用のマーク規則は[見出し付き総評のレンダリング規則](../analysis/findings.md#レンダリング規則)を参照。段落内の最外側の`「…」`を囲む`<q>`要素は`quotes:none`（引用符文字は付与しない）・色`--series-a`で表示する。

## diffボックス

`DiffBox`コンポーネント（`src/app/_parts/components/DiffBox/DiffBox.tsx`、`DiffBox.module.scss`）の`.diffbox`は角丸`--s1`（8px）・枠線`--diff-border`・背景`--diff-bg`（`#fff`、紙色ではなく白固定）。

### ヘッダー

スコープ名（スコープタイトル）＋右寄せの展開/収納ラベルとアイコン。`aria-pressed`で全体展開/収納の状態を持つボタン。

### 行番号・コード列

4列構成（`<colgroup><col class="ln"><col><col class="ln"><col>`）：変更前の行番号／変更前の本文／変更後の行番号／変更後の本文。行番号セル（`td.ln`）は右揃え・等幅数字（`tabular-nums`）・背景`--diff-head-bg`・`user-select:none`。

### 追加・削除行の色

変更行（`<tr className={styles.chg}>`）の削除側セル（`.delSide`）は背景`--diff-del`（コード）／`--diff-del-ln`（行番号）。追加側セル（`.insSide`）は背景`--diff-ins`（コード）／`--diff-ins-ln`（行番号）。対応する行が存在しない側（挿入のみ・削除のみの行）は`.blankSide`（背景`--diff-head-bg`）で埋める。

### 語レベルの強調ボックス

`<mark className={styles.mark}>`（`.mark`）が変更された語句を囲む。既定（削除側）は背景`--diff-del-mark`、`.insSide .mark`は背景`--diff-ins-mark`で追加側を上書きする。差分計算の結果、1文字だけの一致区間が変更区間に挟まれる場合は一致とみなさず変更として扱う（マークが途切れないようにするため）。

### 理由行

各編集箇所の直下に`.reasonRow`（背景`--diff-reason-bg`・下罫線`--diff-reason-border`）が挿入される。中身は`.reasonInline`＝見出し（`h3`、本文書体、「{観点} - {label}を{方向}調整」の形。例：「LSM - 文法語・数量詞を減らす調整」）＋説明段落＋「副作用：」段落（色`--ink-desc`は`.tradeoff`クラス経由）。見出しの方向語は`editList[].isolated`があるときだけ付き、ない候補では方向語なしの見出しになる。

### 折りたたみ制御

変更のない行が前後の文脈（`CONTEXT=3`行、`src/lib/diff/line-diff.ts`）を超える場合、間の行はモデル側で`DiffFoldRow`（`kind:'fold'`。`header`にunified diff形式のハンク見出し、`hidden`に隠し行の配列を持つ、`src/lib/diff/types.ts`）としてまとめられる。`<template>`要素は使わない。`useDiffFold`フック（`src/app/_parts/useReport.ts`）がフォールド行ごとに開示済みの行数（`revealed`）を状態として持ち、`DiffBox`は`row.hidden`の先頭`revealed`件をReactで通常の行として描画したうえで、残りがあれば`tr.fold`（1行、`colspan`で折りたたみ表示）を出す。折りたたみ行はアイコンセル（幅48px、背景`--diff-ln-border`、中央寄せの縦3点アイコン）とラベルセル（背景`--diff-fold-label`、diff形式のハンク見出し＋「N行を非表示」）の2セルで構成する。挙動は[画面仕様のdiffボックスの折りたたみ](./frontend/screen.md#diffボックスの折りたたみ)を参照。

## チップ

`.chip`はドット（`.dot`、12×12px、系列色`.a`＝`--series-a`／`.b`＝`--series-b`）＋系列名のインラインフレックス。ペア棒グラフの下に系列凡例として使う。

## ボタン

`btn-primary`・`btn-secondary`ミックスイン（`src/styles/_variable/template/_button.scss`）。どちらも枠線1px`--ink-2`・padding`--gap-hairline --s2`・本文書体・サイズ`--t-sm`・行送り`--lh-sm`・折り返しなしで、背景・文字色・枠線色を`.2s var(--ease-out)`で切り替える（縮小モーション設定では切り替えなし）。

| 種類      | 見た目                                                                                       | 使う箇所                                       |
| --------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| primary   | 背景`--ink-2`・文字`--paper`。押せない状態（`disabled`）は背景`--paper`・文字と枠線`--ink-4` | なし                                           |
| secondary | 背景`--paper`・文字`--ink-2`                                                                 | ルートとログイン促し画面のログイン・ログアウト |

## リンク・スクロールヒント

通常のリンク（`a`）は色`--ink-2`、hoverで`--ink-1`。「どのように解析？」「レポートをみる」のリンク（`.hint`クラス、`HeroSection.module.scss`／`IntroSection.module.scss`が共通で使う`scroll-hint-link`ミックスイン、`src/styles/_variable/_index.scss`）は明朝体ではなく`--font-hand`（`'Zen Kurenaido',var(--font-head)`）の手書き風書体を使う特別なリンクで、ウェイト700・サイズ`--t-lg`・字間`.06em`・色`--ink-2`。左に縦棒の装飾（`::before`固定表示、`::after`が4秒周期で下から上へ充填されるアニメーション`hint-fill`）を持つ。hoverすると内側の`span`に`hint-blur`アニメーションが掛かる。

## ビューポートセクション・スクロールスナップ

`html{scroll-snap-type:y proximity;scroll-behavior:smooth}`。スナップ対象（`scroll-snap-align:start`）は3つ：`#top`（ヒーロー）、`#analysis-intro`（導入2段落＋軸定義カード）、`.report`（レポート本体全体）。`#top`・`#analysis-intro`は`.viewportSection`クラス（`src/app/_parts/page.module.scss`）で`min-height:100dvh`を持つ。`.report`自体は`min-height`を持たず、その内側の各`ScopePanel`の`.panel`が`min-height:100dvh`を持つ。

`.viewportSection`は`--out`カスタムプロパティ（0〜1、JavaScriptから設定）に応じてフェードアウトする：`opacity:calc(1 - var(--out)*.9)`・`filter:blur(calc(var(--out)*var(--blur-max)))`。

## モーション

### view-timelineによるフェード

`@supports ((animation-timeline: view()) and (animation-range: entry))`が真の場合、`.viewportSection`にスクロール駆動アニメーション（`animation-timeline:view();animation-range:exit 0% exit 60%`）を適用し、`section-out`キーフレーム（`opacity:.1;filter:blur(--blur-max)`まで）でセクションが画面を出て行くときにフェードアウトさせる。この場合、上記`--out`ベースのインラインフェードは使わない（後述の`useViewportFade`フックが`CSS.supports`で分岐する）。

### IntersectionObserverによるフォールバック

`view-timeline`未対応時は、`useViewportFade`フック（`src/app/_parts/useReport.ts`）がヒーローと解析導入の2要素（`viewportSectionRefList`が指す`ref`）をIntersectionObserverで監視し、`boundingClientRect`から`out = clamp(0,1, -rect.top/(height*.6))`を計算して要素へ`style`属性で`--out`をインラインに設定する。

### 縮小モーション設定

`@media(prefers-reduced-motion:reduce)`で無効化されるもの：`.viewportSection`のアニメーション（`--out:0`固定）、`ScopeNav`の`.bar`・`.wrap button`・`.list button::before`のトランジション、`.list button`／`ComparisonTable`の`.name .scopeLink`のhoverアニメーション（`hint-blur`）、`.hint span`のアニメーション、`.hint::after`のアニメーション（`clip-path:none`で常時全表示に固定）、`.chart rect.bar`のトランジション。

## ダークモード

このCSSに`prefers-color-scheme`によるダークテーマの定義はない。

## 印刷

`@media print`で以下を上書きする：`body`背景を`#fff`に固定、`body::before`（粒子レイヤー）を非表示、`.viewportSection`の`--out`を0固定（フェードなし）、`main`を`display:block;padding:0`（グリッドレイアウトを解除）、`.chart`の`overflow`を`visible`、`svg`の`min-width`を`0`（横スクロール前提の最小幅576pxを解除して用紙幅に収める）、`.chart`に`break-inside:avoid`、`.analysisTitle`・`h3`に`break-after:avoid`（見出し直後の改ページを避ける）。
