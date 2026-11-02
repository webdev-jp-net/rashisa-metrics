#!/usr/bin/env bun
/**
 * @file 1スコープ分の変更案を生成・公開するワークフローの各段階（prepare・evaluate・publish・refresh-copy）を
 *   実行する。全体の流れは_llm-docs/analysis/revision-workflow.md。
 */
import { loadReportConfig } from '../src/lib/config/report-config'
import { diffDataPath } from '../src/lib/data/report-data'
import { evaluationPath } from '../src/lib/data/propose'
import { evaluate } from '../src/lib/revision/evaluate'
import { ensure } from '../src/lib/revision/io'
import type { RevisionContext } from '../src/lib/revision/measure'
import { prepare } from '../src/lib/revision/plan'
import { publish } from '../src/lib/revision/publish'
import { refreshCopy } from '../src/lib/revision/refresh-copy'
import type { Tokenizer } from '../src/lib/morph'
import { runCli, seriesArg } from './cli'

/** コマンドの第1引数で選ぶ段階。 */
const STAGE_LIST = ['prepare', 'evaluate', 'publish', 'refresh-copy'] as const
type Stage = (typeof STAGE_LIST)[number]

/**
 * 形態素解析器の読み込み。遅延読み込みにすることで、revisionライブラリの型チェックとユニットテストは解析器なしで実行できる。
 *
 * @returns 現在の解析器。
 * @throws 読み込めなければ原因を添えて止める。
 */
async function loadTokenizer(): Promise<Tokenizer> {
  try {
    const module = await import('../src/lib/morph/lindera-unidic')
    return module.createLinderaUnidicTokenizer()
  } catch (error) {
    throw new Error(
      'src/lib/morph/lindera-unidic.ts (createLinderaUnidicTokenizer) could not be loaded; ' +
        'the measuring stages need it: ' +
        String(error)
    )
  }
}

/**
 * 引数`--check`（書き込まず、生成結果が公開済みファイルと一致するかだけ確認する）はpublish段階だけが受け付ける（revision-workflow.md）。
 * スコープidが設定の`scopeList`に実在するかは、設定読み込み後に呼び出し側（`main`）が確認する。
 *
 * @param argv `process.argv.slice(2)`。第1要素が段階名。
 * @returns 段階・スコープid・`--check`の有無。
 * @throws 引数が不正なら止める。
 */
function parseArgs(argv: string[]): { stage: Stage; scope: number; check: boolean } {
  const stage = argv[0] as Stage
  ensure(STAGE_LIST.includes(stage), `stage must be one of ${STAGE_LIST.join('|')}`)
  const scopeIndex = argv.indexOf('--scope')
  ensure(scopeIndex !== -1 && argv[scopeIndex + 1] !== undefined, '--scope N is required')
  const scope = Number(argv[scopeIndex + 1])
  ensure(Number.isInteger(scope), '--scope must be an integer')
  const check = argv.includes('--check')
  ensure(!check || stage === 'publish', '--check is only for publish')
  return { stage, scope, check }
}

/**
 * 引数で指定した段階（prepare・evaluate・publish・refresh-copy）を、指定した1スコープに対して実行する。
 * 変更案の生成は、計画→agentの候補作成→評価→全文レビュー→公開と、人とagentの作業を挟んで段階的に進むため、
 * 1回の実行で1段階だけを進める。
 *
 * @throws 引数が不正、またはシリーズの設定が読めなければ止める。
 * @example
 * bun run scripts/revision.ts prepare --scope 1 --series <seriesKey>
 * bun run scripts/revision.ts evaluate --scope 1 --series <seriesKey>
 * bun run scripts/revision.ts publish --scope 1 --series <seriesKey>
 * bun run scripts/revision.ts publish --scope 1 --check --series <seriesKey>    # 検証のみ、書き込みしない
 * bun run scripts/revision.ts refresh-copy --scope 1 --series <seriesKey>
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const { stage, scope, check } = parseArgs(argv)
  const config = loadReportConfig(seriesArg(argv))
  const known = config.scopeList.map(entry => entry.id)
  ensure(known.includes(scope), `--scope must be one of ${known.join(',')}`)
  const ctx: RevisionContext = { config, tokenizer: await loadTokenizer() }

  if (stage === 'prepare') {
    const { plan, path } = prepare(ctx, scope)
    console.log(
      JSON.stringify({
        plan: path,
        blocks: plan.blockList.length,
        targets: plan.targetList.length,
      })
    )
    return
  }
  if (stage === 'evaluate') {
    const payload = evaluate(ctx, scope)
    console.log(
      JSON.stringify({
        evaluation: evaluationPath(config, scope),
        candidates: (payload.selected ?? []).length,
        selected: payload.selected.length,
        problemList: payload.problemList,
        review: 'Full revised-text review required before publish',
      })
    )
    return
  }
  if (stage === 'publish') {
    const { data, path } = publish(ctx, scope, check)
    console.log(JSON.stringify({ published: path, selected: data.editList.length, check }))
    return
  }
  const { changed } = refreshCopy(ctx, scope)
  console.log(
    JSON.stringify({
      refreshed: diffDataPath(config, scope),
      explanations: changed.length,
    })
  )
}

void runCli(main)
