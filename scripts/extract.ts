#!/usr/bin/env bun
/**
 * @file 抽出処理の工程（prepare・verify）を実行する。全体の流れは_llm-docs/analysis/extraction.md。
 */
import { loadReportConfig } from '../src/lib/config/report-config'
import { mismatchedCheckList, prepare } from '../src/lib/extract/prepare'
import { verify } from '../src/lib/extract/verify'
import type { Tokenizer } from '../src/lib/morph'
import { ensure } from '../src/lib/revision/io'
import type { RevisionContext } from '../src/lib/revision/measure'
import { runCli, seriesArg } from './cli'

/** コマンドの第1引数で選ぶ工程。 */
const STAGE_LIST = ['prepare', 'verify'] as const
type Stage = (typeof STAGE_LIST)[number]

/**
 * 形態素解析器の読み込み。遅延読み込みにすることで、計測を伴わない`verify`は解析器なしで実行できる。
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
 * 引数`--check`（書き込まず、計測結果が保存済みプロファイルと一致するかだけ確認する）はprepare工程だけが受け付ける。
 *
 * @param argv `process.argv.slice(2)`。第1要素が工程名。
 * @returns 工程と`--check`の有無。
 * @throws 引数が不正なら止める。
 */
function parseArgs(argv: string[]): { stage: Stage; check: boolean } {
  const stage = argv[0] as Stage
  ensure(STAGE_LIST.includes(stage), `stage must be one of ${STAGE_LIST.join('|')}`)
  const check = argv.includes('--check')
  ensure(!check || stage === 'prepare', '--check is only for prepare')
  return { stage, check }
}

/**
 * 引数で指定した工程を実行する。`prepare`は原資料から文体プロファイル一式を作り、`verify`はそれと
 * agentが書いた実例集・書き方シート・統合文書の形式を検査する。
 *
 * @throws 引数が不正、シリーズの設定が読めない、または原資料が読めなければ止める。
 * @example
 * bun run scripts/extract.ts prepare --series <seriesKey>
 * bun run scripts/extract.ts prepare --check --series <seriesKey>    # 照合のみ、書き込みしない
 * bun run scripts/extract.ts verify --series <seriesKey>
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const { stage, check } = parseArgs(argv)
  const config = loadReportConfig(seriesArg(argv))

  if (stage === 'verify') {
    const failureList = verify(config)
    if (failureList.length > 0) {
      console.log(JSON.stringify({ status: 'FAIL', failureList }))
      process.exit(1)
    }
    console.log(JSON.stringify({ status: 'PASS' }))
    return
  }

  const ctx: RevisionContext = { config, tokenizer: await loadTokenizer() }
  const result = prepare(ctx, { check })
  if (!check) {
    console.log(JSON.stringify({ written: result.written }))
    return
  }
  const mismatched = mismatchedCheckList(result.checkList)
  console.log(
    JSON.stringify({
      check: true,
      profiles: result.checkList.length,
      matched: result.checkList.length - mismatched.length,
      mismatched,
    })
  )
  if (mismatched.length > 0) process.exit(1)
}

void runCli(main)
