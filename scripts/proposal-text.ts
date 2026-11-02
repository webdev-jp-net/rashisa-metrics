#!/usr/bin/env bun
/**
 * @file 変更案の読者向け説明文（`displayReason`・`tradeoff`）に、内部IDや資料名が混じっていないかを検査する。
 */
import { readJson } from '../src/lib/data/json-io'
import { validateCopy } from '../src/lib/revision/reader-copy'
import { runCli } from './cli'

/**
 * 引数で渡した候補ファイル（`candidatesN.json`）または公開済みデータ（`diff_dataN.json`）の読者向け説明文
 * （`displayReason`・`tradeoff`）を検査し、内部IDや資料名が混じっていれば全件を列挙して終了コード1で止める。
 * agentが候補を書いた直後、計測（evaluate）に進む前に説明文だけを検査するための入口
 * （検査規則は`src/lib/revision/reader-copy.ts`）。
 *
 * @example
 * bun run scripts/proposal-text.ts data/<seriesKey>/propose/candidates1.json
 */
function main(): void {
  const fileList = process.argv.slice(2).filter(argument => !argument.startsWith('-'))
  if (fileList.length === 0) {
    console.error('usage: bun run scripts/proposal-text.ts <candidates or diff json> ...')
    process.exit(2)
  }

  const errorList: string[] = []
  for (const path of fileList) {
    const data = readJson<Record<string, unknown>>(path)
    const key = 'candidateList' in data ? 'candidateList' : 'editList'
    const entryList = data[key]
    if (!Array.isArray(entryList)) {
      errorList.push(`${path}: candidateList または editList が必要です`)
      continue
    }
    try {
      validateCopy(entryList as Record<string, unknown>[], path)
    } catch (error) {
      errorList.push(error instanceof Error ? error.message : String(error))
    }
  }

  if (errorList.length > 0) {
    console.error(errorList.join('\n'))
    process.exit(1)
  }
  console.log('説明文チェック OK')
}

void runCli(main)
