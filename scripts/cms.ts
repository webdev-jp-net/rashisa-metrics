#!/usr/bin/env bun
/**
 * @file 画面が読む表示材料をmicroCMSへ送り（push）、総評本文を取り込む（import-findings）。
 *   送る内容の組み立てと書き込みは`scripts/cms-content.ts`。
 */
import { resolve } from 'node:path'
import { createReportClient } from '../src/lib/api/microcms'
import { loadReportConfig } from '../src/lib/config/report-config'
import { readJson } from '../src/lib/data/json-io'
import type { FindingTexts } from '../src/lib/data/report-data'
import { ensure } from '../src/lib/revision/io'
import { importFindings, runPush } from './cms-content'
import { runCli, seriesArg } from './cli'

/** コマンドの第1引数で選ぶ工程。 */
const COMMAND_LIST = ['push', 'import-findings'] as const
type Command = (typeof COMMAND_LIST)[number]

/**
 * 引数`--check`（送らず、いまmicroCMSにある内容との差分だけを出す）はpushだけが受け付ける。
 * `import-findings`は総評本文のファイルパスを第2引数に取る。
 *
 * @param argv `process.argv.slice(2)`。第1要素が工程名。
 * @returns 工程・`--check`の有無・総評本文のパス。
 * @throws 引数が不正なら止める。
 */
function parseArgs(argv: string[]): { command: Command; check: boolean; path: string } {
  const command = argv[0] as Command
  ensure(COMMAND_LIST.includes(command), `command must be one of ${COMMAND_LIST.join('|')}`)
  const check = argv.includes('--check')
  ensure(!check || command === 'push', '--check is only for push')
  const path = argv[1] ?? ''
  ensure(
    command !== 'import-findings' || (path !== '' && !path.startsWith('-')),
    'import-findings <path> requires the path of a finding_texts.json-shaped file'
  )
  return { command, check, path }
}

/**
 * 引数で指定した工程を実行する。`push`は全スコープの表示材料を送り、`import-findings`は
 * 総評本文だけを送る。送り先は引数`--series`のシリーズで、microCMSに登録済みであること。
 * 送信先のサービスとAPIキーは環境変数で渡す。
 *
 * @throws 引数が不正、シリーズの設定が読めない、シリーズがmicroCMSに無い、原稿と変更案が一致しない、
 *   またはmicroCMSが要求を拒めば止める。
 * @example
 * bun --env-file=.env.local run scripts/cms.ts push --series <seriesKey>
 * bun --env-file=.env.local run scripts/cms.ts push --check --series <seriesKey>    # 差分表示のみ、送信しない
 * bun --env-file=.env.local run scripts/cms.ts import-findings data/<seriesKey>/report/finding_texts.json --series <seriesKey>
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const { command, check, path } = parseArgs(argv)
  const config = loadReportConfig(seriesArg(argv))
  const client = createReportClient()

  if (command === 'push') {
    console.log(JSON.stringify(await runPush(client, config, { check })))
    return
  }

  const textList = readJson<FindingTexts>(resolve(config.root, path))
  console.log(JSON.stringify(await importFindings(client, config.seriesKey, textList)))
}

void runCli(main)
