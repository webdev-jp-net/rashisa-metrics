# 文体比較レポート仕様

お手本媒体と編集対象媒体を4観点・26指標の文体計測で比較し、スコープごとの変更案と見出し付き総評を表示するレポートの仕様。媒体名・スコープの表示名はmicroCMSの`series`が持つ。手元の作業は`data/index.json`の1シリーズずつ、引数`--series <seriesKey>`で選ぶ。

- [抽出処理](./extraction.md) - 原資料から文体プロファイル・実例集・書き方シート・統合文書を作る`extract prepare`/`extract verify`の仕様
- [計測仕様](./measurement.md) - 入力整形・文書の前処理・文分割・トークナイザ契約・26指標の定義とプロファイルJSONの形
- [判定規則（overview-3）](./overview-policy.md) - 27項目の強調・分類・対象指標選定と`overview_criteria.json`/`comparison_data*.json`
- [章単位編集案（chapter-revision-4）](./revision-workflow.md) - prepare/evaluate/publishの固定ワークフロー、候補・評価・公開データのスキーマ、原資料への反映手順
- [見出し付き総評](./findings.md) - `finding_texts.json`のスキーマと執筆・レンダリング規則
- [データ配置](./data-layout.md) - `source/`・`data/`・`config/`の入出力関係とfind-cliche
