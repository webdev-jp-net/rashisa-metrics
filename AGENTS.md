# Project Instructions

## ルールと記録の読み込み

- 着手前に、セッション開始時に提示される必読ファイルをすべて読む（一覧の定義は`.claude/hooks/read-gate.ts`）
- 一部を選ぶのではなく全部読み、全部に従う。省略・要約・取捨選択をしない

## タスク実行ワークフロー

セッション中の各タスクについて:

1. タスクが関連する`_llm-docs/`配下の仕様書・運用ドキュメントを読み込み
2. core_rules.mdのプロセスにしたがって実行開始
3. 状態記録・検証ループ・実行履歴の記録は`_llm-rules/self_improvement.md`に従う（記録の正本は`_llm-memories/`）

## 用語統一システム

- 用語の正式な情報源として`_llm-docs/operation/dictionary.md`を使用

---

**⚠️ このファイルはAIエージェントのエントリーポイント。運用原則は\_llm-rules/、制御機構とワークフローは.claude/にあります。**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
