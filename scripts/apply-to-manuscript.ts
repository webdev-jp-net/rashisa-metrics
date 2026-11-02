#!/usr/bin/env bun
/**
 * @file 公開済みの変更案を全スコープ分すべて反映した、改稿版のスコープ別ファイル一式を作る。
 */
import { loadReportConfig } from '../src/lib/config/report-config'
import { applyToManuscript } from '../src/lib/revision/apply-to-manuscript'
import { ensure } from '../src/lib/revision/io'
import { runCli, seriesArg } from './cli'

/**
 * 公開済みの変更案を全スコープ分反映した改稿版を、引数`--out <dir>`で指定したディレクトリへ
 * 原資料と同じファイル名で書く。原資料ディレクトリは上書きしない。書き戻し前の原資料は
 * `sourceHashList`の入力なので、失うと全スコープの公開データが無効になる。
 *
 * @throws `--out`が無い、シリーズの設定が読めない、または`--out`が原資料ディレクトリを指していれば止める。
 * @example
 * bun run scripts/apply-to-manuscript.ts --series <seriesKey> --out /path/to/revised_scopes
 */
function main(): void {
  const argv = process.argv.slice(2)
  const index = argv.indexOf('--out')
  ensure(index !== -1 && argv[index + 1] !== undefined, '--out <dir> is required')
  const out = argv[index + 1]!

  const config = loadReportConfig(seriesArg(argv))
  const result = applyToManuscript(config, out)
  console.log(JSON.stringify({ written: result.written, scopes: result.scopes }))
}

void runCli(main)
