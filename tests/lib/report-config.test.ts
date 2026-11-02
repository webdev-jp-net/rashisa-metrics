/**
 * Which series the real-data tests read: the one named by the SERIES_KEY environment variable.
 * Every file is synthetic and written under a throwaway repository, so the real data/ and source/
 * trees are never read.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { tryLoadReportConfig } from '@/lib/config/report-config'

const ANONYMIZATION = {
  model: { termList: [], exceptionList: [], authorTerm: '' },
  edited: { termList: [], exceptionList: [], authorTerm: '' },
}

/** 実行時に設定されていた値。各テストの後に戻す。 */
const ORIGINAL_SERIES_KEY = process.env.SERIES_KEY

let root: string | null = null

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = null
  if (ORIGINAL_SERIES_KEY === undefined) delete process.env.SERIES_KEY
  else process.env.SERIES_KEY = ORIGINAL_SERIES_KEY
})

/**
 * 一時リポジトリに、config/report.json・`data/index.json`・各シリーズのスコープと原稿ファイルの対応を書く。
 *
 * @param seriesKeyList `data/index.json`に並べるシリーズ。
 * @returns 一時リポジトリのルート。
 */
function openRoot(seriesKeyList: string[]): string {
  const base = mkdtempSync(join(tmpdir(), 'rashisa-series-'))
  root = base
  mkdirSync(join(base, 'config'), { recursive: true })
  writeFileSync(
    join(base, 'config/report.json'),
    JSON.stringify({ pathList: { lsmCategories: 'l.yaml', keigoLexicon: 'k.yaml' } }),
    'utf-8'
  )
  mkdirSync(join(base, 'data'), { recursive: true })
  writeFileSync(
    join(base, 'data/index.json'),
    JSON.stringify(
      seriesKeyList.map(seriesKey => ({
        seriesKey,
        modelSource: `source/${seriesKey}/model`,
        editedSource: `source/${seriesKey}/edited`,
        anonymization: ANONYMIZATION,
      }))
    ),
    'utf-8'
  )
  for (const seriesKey of seriesKeyList) {
    const dir = join(base, `source/${seriesKey}/edited`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify([{ id: 0, file: 'scope-00.md' }]),
      'utf-8'
    )
  }
  return base
}

describe('tryLoadReportConfig', () => {
  test('reports no real data while SERIES_KEY is not set', () => {
    const base = openRoot(['series-a'])
    delete process.env.SERIES_KEY

    expect(tryLoadReportConfig(base).hasSeriesConfig).toBe(false)
  })

  test('reads the series named by SERIES_KEY, not the first one listed', () => {
    const base = openRoot(['series-a', 'series-b'])
    process.env.SERIES_KEY = 'series-b'

    const { hasSeriesConfig, config } = tryLoadReportConfig(base)

    expect(hasSeriesConfig).toBe(true)
    expect(config.seriesKey).toBe('series-b')
    expect(config.pathList.report).toBe(join(base, 'data/series-b/report'))
  })

  test('stops on a SERIES_KEY that data/index.json does not list', () => {
    const base = openRoot(['series-a'])
    process.env.SERIES_KEY = 'series-x'

    expect(() => tryLoadReportConfig(base)).toThrow("seriesKey 'series-x'")
  })
})
