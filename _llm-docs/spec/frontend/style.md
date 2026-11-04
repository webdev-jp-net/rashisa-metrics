# スタイリング方針

## スタイリング方針の位置づけ

このドキュメントは、スタイリングに関する実装方針と参照先をまとめたものです。

## 技術スタック

- **SCSS Modules**: ページ・コンポーネント単位のスタイリング
- **グローバルSCSS**: `src/styles/index.scss`および`_variable`配下

## スタイリング哲学

### スタイル記述の技術選定

- **非ユーティリティファースト**: 意味のあるクラス名を使用する
- **セマンティクス志向**: コンポーネントの役割を表すクラス名
- **CSS Modules**: スコープ化されたCSS（BEM命名不要）
- **SCSS**: ネストや変数を活用した保守性の高いスタイル

### セマンティックスタイリング

- 装飾を表現した命名を避け、用途や意味を基準とした命名にする
- ユーティリティファースト設計禁止
- BEM命名禁止（CSS Modulesでスコープ分離済み）
- ファイル名（`*.module.scss`）は[開発用ネーミング辞書](../../operation/dictionary.md)の規則に従う。クラス名自体の命名規則は辞書にはなく、本節の用途・意味基準に従う
- 状態を表すクラスは`--isActive`のように接尾辞で表現する

## デザイントークン

色・書体・余白等のトークンは[デザインシステム](../design-system.md)を正本とし、`src/styles/index.scss`の`:root`にCSSカスタムプロパティとして定義する。コンポーネント側はトークンを直接参照し、値を書き直さない。幅方向のブレークポイントは定義しない。

色・書体・余白・罫線幅・影・イージングなど、トークンが存在する種類の値は既定としてトークンで指定する。ただし規約遵守より視認結果を優先する場面（局所の寸法・タイミング・濃淡の微調整）では、トークンを外した直書きを許容する。

## 要素間の余白の組み方

兄弟要素の間隔は、親のflex/gridの`gap`で取る。子要素ごとに`margin`を振って間隔を作らない。`margin`を使うのは次の用途に限る：ブラウザ既定の余白を`0`にする初期化、`margin-left`/`margin-right:auto`等による単独要素の中央寄せ・端寄せ、罫線の重なりを合わせるための負のマージンのように、`gap`で表せない単発の調整。このプロジェクトのSCSSは物理プロパティ（`margin-left`・`padding-top`等）で統一し、論理プロパティ（`margin-inline`・`padding-block`等）は使わない。

## 単位

CSSカスタムプロパティのトークン（`--s2`等の間隔トークン、`--chart-w`等）と、`src/styles/_variable`の`rem()`関数（16px基準）で指定する。例外は罫線幅（1px・2px）、ぼかし半径、`box-shadow`の複合値（オフセット・ぼかし・広がりの組み合わせで、文字サイズに連動させると見た目の質感が崩れるため）、割合を示す`%`。

## mixin

共通のスタイルは`src/styles/_variable`のfunction／mixin／templateに一元管理し、重複を排除する。

| mixin                | 用途                                                                            |
| -------------------- | ------------------------------------------------------------------------------- |
| `rem`                | px値をrem値に変換する関数（16px基準）                                           |
| `rect`               | widthとheightに同じ値を指定する                                                 |
| `chart-surface`      | カード状の図版面（ペア棒グラフ・LSMスケールバー共通）                           |
| `chart-bar-motion`   | 図版内のバー。画面内に入るまで縮んだ状態で待機する（`@layer layout`側）         |
| `chart-bar-states`   | 上記バーの表示・reduced-motion・print対応（`@layer states`側）                  |
| `scroll-hint-link`   | 次のセクションへ誘導する手書き風リンク本体（左に縦棒の装飾、`@layer layout`側） |
| `scroll-hint-states` | 上記リンクのreduced-motion対応（`@layer states`側）                             |
| `hint-blur`          | hover時に文字が一瞬ぼやけて戻るアニメーション                                   |
| `btn-primary`        | 塗りのボタン（本体・押せない状態）                                              |
| `btn-secondary`      | 枠線のボタン                                                                    |
| `btn-tab`            | 下罫線タブのボタン（本体・hover・active・選択中の4状態）                        |

利用側は次のように`@use`する。

```scss
@use '@/styles/_variable' as *;
.example {
  @include chart-surface;
}
```

幅方向のブレークポイントは定義しない。レイアウトは[デザインシステム](../design-system.md)のとおり。

## 装飾の実装ルール

装飾（色、影、ボーダー、アニメーション等）は[デザインシステム](../design-system.md)で明示された範囲のみ実装する。指示のない装飾の追加は禁止する。

## 参照する外部資料

- [Next.js CSS Modules](https://nextjs.org/docs/app/building-your-application/styling/css-modules)
- [MDN Web Docs - Semantics](https://developer.mozilla.org/en-US/docs/Glossary/Semantics)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)
