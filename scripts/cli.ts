import { ensure } from '../src/lib/revision/io'

/**
 * CLIの失敗時にスタックトレースではなくメッセージだけを出して終了コード1で止める。
 * ワークフローの前提条件チェック（`ensure`）が投げるエラーは利用者向けの文言なので、スタックは不要。
 *
 * @param main CLIの本体。例外を投げて失敗を伝える。
 */
export async function runCli(main: () => void | Promise<void>): Promise<void> {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

/**
 * 作業対象のシリーズを引数`--series <seriesKey>`から取る。設定を読むどのCLIも同じ引数で受け取る。
 * そのシリーズが`data/index.json`にあるかは、設定を読む`loadReportConfig`が確かめる。
 *
 * @param argv `process.argv.slice(2)`。
 * @returns `seriesKey`。
 * @throws `--series`が無い、または値が無ければ止める。
 */
export function seriesArg(argv: string[]): string {
  const index = argv.indexOf('--series')
  const value = index === -1 ? undefined : argv[index + 1]
  ensure(
    value !== undefined && !value.startsWith('-'),
    '--series <seriesKey> is required (one of the seriesKey values in data/index.json)'
  )
  return value
}
