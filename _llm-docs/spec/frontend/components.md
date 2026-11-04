# コンポーネント設計

## コンポーネント分割の前提

Next.js App Router + React + TypeScriptを前提としたコンポーネント分割指針。UIライブラリは採用せず、SCSS Modulesで最小限の装飾を行う。

## 設計原則

### 表示とロジックの分離

- `*.tsx`はView（表示責務）のみ
- `use*.ts`はLogic（状態管理・データ変換ロジック）を担当
- App Routerのページでも`_parts`ディレクトリを用いて責務を分割

### 単一責任

- 1つのコンポーネントが扱う責務は明確に絞る
- ページ固有の処理は`src/app/_parts/`へ配置
- ページ固有でも繰り返し使うUI部品は`_parts/components/[ComponentName]/`にparts-component構造で切り出す

### 型安全

- すべてのProps・戻り値にTypeScript型を付与する

## ディレクトリ構造

コンポーネントに関わる範囲のディレクトリ構造。全体は[プロジェクト概要のディレクトリ一覧](../../project.md#ディレクトリ一覧)を参照。

```
src/
└── app/                                # App Routerのページ・レイアウト
    ├── layout.tsx
    ├── page.tsx                        # ルート（シリーズの一覧）
    ├── [seriesKey]/page.tsx + _parts/  # レポート本体（シリーズごとのパス）
    └── _parts/components/              # 共通部品（parts-component構造）
```

## parts-component構造

```
[Name]/
├── index.ts
├── [Name].tsx
├── [Name].module.scss
└── use[Name].ts            # ロジックを分離する場合のみ
```

## 命名規則

- ディレクトリ・コンポーネント名: PascalCase
- hook名: `useXxx`形式（PascalCaseで命名）
- SCSS: ファイル名は`*.module.scss`（[辞書](../../operation/dictionary.md)の規則）。クラス名自体の命名規則は[スタイリング方針](./style.md#セマンティックスタイリング)の用途・意味基準に従う

## View層の責務

- UI描画
- 最小限のイベントハンドリング（処理本体はhookへ委譲）
- `_parts/view.tsx`は`"use client"`で宣言し、サーバー側から受け取ったデータを表示する

## Logic層の責務

- `use*.ts`に状態管理・データ変換ロジックを配置する
- データ取得・計測は`src/lib`の関数を利用する
- hookはViewに必要な値・ハンドラーを返却する

## コンポーネント間の状態共有

グローバルストアは持たない。タブ状態とハッシュ同期は`useReport.ts`に置く。

## このページのコンポーネント

`src/app/_parts/components/`に置く、レポート本体専用のparts-component。

| コンポーネント  | 責務                                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SeriesIndex`   | ルート（`/`）の画面。`LoginPrompt`と同じ構成のタイトル・リード文・段落に続けて、小見出し付きの閲覧できるシリーズへのリンクの一覧と、注釈、未ログインならログイン、ログイン済みならログアウトのボタンを出す                          |
| `LoginPrompt`   | 許可されたGoogleアカウントでログインしていない場合に、レポート本体の代わりに表示する。`HeroSection`と同じ構成（サイトタイトル・リード文）に、未ログイン・非許可の状態ごとの文言とボタン（ログインする／ログアウトする）を続けて出す |
| `HeroSection`   | タイトル・リード・導入文と「どのように解析？」リンクを表示する                                                                                                                                                                      |
| `IntroSection`  | 導入2段落と「レポートをみる」リンク、観点カード4枚を表示する                                                                                                                                                                        |
| `ViewpointCard` | 1観点（LSM・文末表現・敬語の密度・文・段落の長さ）の定義カードを表示する                                                                                                                                                            |
| `ScopeNav`      | position:stickyで固定するスコープ切替ナビ。先頭のタイトルリンク・スコープタブ（全体・はじめに〜おわりに）を表示する                                                                                                                 |
| `ScopePanel`    | 1スコープ分の提案パネルと分析パネルをまとめる                                                                                                                                                                                       |
| `ProposalPanel` | スコープの提案内容を表示する。全体スコープは`TotalProposal`、個別スコープは`ScopeProposal`を出し分ける                                                                                                                              |
| `TotalProposal` | 全体スコープの導入文・総括の寸評、フィルター付き比較テーブル（`ComparisonTable`）を表示する                                                                                                                                         |
| `ScopeProposal` | 個別スコープの対象行、LSMの前後（`LsmBeforeAfter`）、再測定テーブル（`RemeasureTable`）、diff提案の一覧（`DiffBox`）を表示する                                                                                                      |
| `AnalysisPanel` | 観点切替タブと、選択中観点の分析内容（`LsmFigure`・`PairChart`・`DataTable`・`FindingText`）を表示する                                                                                                                              |
| `DiffBox`       | 変更案1件の行diff・語のハイライト・理由行・折りたたみ操作を表示する                                                                                                                                                                 |
| `NumberBadge`   | 観点タブ・比較テーブルのフィルターボタン・再測定テーブルのスコープ見出しで使う装飾的な2桁番号バッジを表示する                                                                                                                       |
| `Icon`          | Phosphorアイコンを表示する（SVG）                                                                                                                                                                                                   |

## 装飾

装飾は[デザインシステム](../design-system.md)で明示された範囲のみ実装する。
