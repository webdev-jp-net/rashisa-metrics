import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { chapterSource } from '@/lib/text/chapter-source'
import { sha256String } from '@/lib/data/json-io'
import { scopeSourcePath, tryLoadReportConfig } from '@/lib/config/report-config'
import { loadDiffData } from '@/lib/data/report-data'

// Never assert on or print the source material's actual text (PII-bearing) — only on its sha256,
// and only via loaded fixture data, never literal strings in this file.

const { hasSeriesConfig, config } = tryLoadReportConfig()
const scopeIdList = hasSeriesConfig ? config.scopeList.map(scope => scope.id) : []

describe.skipIf(!hasSeriesConfig)('chapterSource', () => {
  const scopeText = (scope: number): string => readFileSync(scopeSourcePath(config, scope), 'utf-8')

  test.each(scopeIdList)('reproduces the exact original chapter text for scope %d', scope => {
    const diff = loadDiffData(config, scope)
    const { text } = chapterSource(scopeText(scope))
    // originalTextSha256 is the hash of the RAW preprocessed text (before clean()), so the
    // per-scope files must reproduce it byte for byte.
    expect(sha256String(text)).toBe(diff.originalTextSha256)
  })

  test('drops horizontal rules, heading markers and the surrounding blank lines', () => {
    const { text, lineList } = chapterSource('\n# 見出し\n\n本文\n\n---\n\n')
    expect(text).toBe('見出し\n\n本文')
    expect(lineList).toEqual([2, 3, 4])
  })

  test('1-based line numbers stay inside the file and never repeat', () => {
    const raw = scopeText(0)
    const { lineList } = chapterSource(raw)
    const total = raw.split(/\r\n|\r|\n/).length
    for (const lineNumber of lineList) {
      expect(lineNumber).toBeGreaterThanOrEqual(1)
      expect(lineNumber).toBeLessThanOrEqual(total)
    }
    // Strictly increasing: no reordering, no duplicates.
    for (let i = 1; i < lineList.length; i += 1) {
      expect(lineList[i]).toBeGreaterThan(lineList[i - 1])
    }
  })
})
