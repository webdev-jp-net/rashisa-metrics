#!/usr/bin/env bun
/**
 * @file 全スコープの公開データ（`diff_dataN.json`）をまとめて生成し直す。引数`--check`があれば書き込まず、
 *   生成結果が公開済みファイルと一致するかの検証だけ行う。
 *   公開データの組み立て方（`src/lib/revision`）を変えたときに使う。
 */
import { existsSync } from 'node:fs'
import { loadReportConfig, type ReportConfig } from '../src/lib/config/report-config'
import { readJson } from '../src/lib/data/json-io'
import { diffDataPath } from '../src/lib/data/report-data'
import { ensure } from '../src/lib/revision/io'
import type { RevisionContext } from '../src/lib/revision/measure'
import { publish } from '../src/lib/revision/publish'
import { REVISION_VERSION } from '../src/lib/revision/types'
import type { Tokenizer } from '../src/lib/morph'
import { runCli, seriesArg } from './cli'

/**
 * 形態素解析器の読み込み。失敗時は原因を利用者向けの文言にして止める。
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
        'regenerating diff data needs it: ' +
        String(error)
    )
  }
}

/**
 * CLI引数を解釈する。
 *
 * @param argv `process.argv.slice(2)`。
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 対象スコープ（引数`--scope N`で指定。無ければ設定にある全スコープ）と、`--check`（検証のみ）の有無。
 * @throws 引数が不正なら止める。
 */
function parseArgs(argv: string[], config: ReportConfig): { scopeList: number[]; check: boolean } {
  const all = config.scopeList.map(scope => scope.id).sort((a, b) => a - b)
  const known = new Set(all)
  const scopeList: number[] = []
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--scope') continue
    const value = Number(argv[i + 1])
    ensure(Number.isInteger(value) && known.has(value), `--scope must be one of ${all.join(',')}`)
    scopeList.push(value)
    i += 1
  }
  return { scopeList: scopeList.length > 0 ? scopeList : all, check: argv.includes('--check') }
}

/**
 * スコープの公開済みデータ`diff_dataN.json`の形式版を読む。旧版の上書きを避けるための事前確認に使う。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 公開済みデータの`version`。未公開または`version`が無ければnull。
 */
function publishedVersion(config: ReportConfig, scope: number): string | null {
  const path = diffDataPath(config, scope)
  if (!existsSync(path)) return null
  return readJson<{ version?: string }>(path).version ?? null
}

/**
 * 対象スコープ（既定は全スコープ）の公開データ`diff_dataN.json`を、`revision.ts publish`と同じ処理で順に生成し直す。
 * 引数`--check`があれば書き込まず、生成結果が公開済みファイルと一致するかの検証だけ行う。
 * plan入力（`sourceHashList`）が変わっているスコープはpublishと同様に止まる。旧versionのデータは現在の仕様では
 * 再生成できないので、上書きせずに先に止める。
 *
 * @throws シリーズの設定が読めない、または旧versionのスコープが含まれていれば止める。
 * @example
 * bun run scripts/build-chapter-diffs.ts --series <seriesKey>                    # 全スコープ
 * bun run scripts/build-chapter-diffs.ts --series <seriesKey> --scope 1 --scope 2
 * bun run scripts/build-chapter-diffs.ts --series <seriesKey> --check            # 検証のみ、書き込みしない
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const config = loadReportConfig(seriesArg(argv))
  const { scopeList, check } = parseArgs(argv, config)

  const legacy = scopeList.filter(scope => {
    const version = publishedVersion(config, scope)
    return version !== null && version !== REVISION_VERSION
  })
  ensure(
    legacy.length === 0,
    `Scopes ${legacy.join(', ')} are published under an older specification ` +
      "('chapter-local-edits-1'); regenerating those fixed edit plans is not supported."
  )

  const ctx: RevisionContext = { config, tokenizer: await loadTokenizer() }
  for (const scope of scopeList) {
    const { data, path } = publish(ctx, scope, check)
    console.log(
      JSON.stringify({
        data: path,
        edits: data.editList.length,
        mode: check ? 'verified' : 'generated',
        targetList: data.metricList.filter(metric => metric.target),
      })
    )
  }
}

void runCli(main)
