/**
 * Line-local splicing back into the per-scope source files, and the write-back entry point
 * applyToManuscript. The unit tests run against a throwaway repository built by the extract
 * fixture, never the real source/ and data/ trees; the integration test at the bottom rebuilds the
 * real scope files from the published diff data and verifies them against every scope's
 * revisedTextSha256 without writing anything and without printing any source text.
 */
import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  scopeSourcePath,
  tryLoadReportConfig,
  type ReportConfig,
} from '../../../src/lib/config/report-config'
import { sha256String } from '../../../src/lib/data/json-io'
import { diffDataPath, loadDiffData } from '../../../src/lib/data/report-data'
import {
  applyToManuscript,
  buildScopeFile,
  spliceString,
  verifyScopeFile,
} from '../../../src/lib/revision/apply-to-manuscript'
import { applyEdits } from '../../../src/lib/revision/evaluate'
import { saveJson } from '../../../src/lib/revision/io'
import { chapterText } from '../../../src/lib/revision/measure'
import { REVISION_VERSION } from '../../../src/lib/revision/types'
import type { PublishedDiffData, RevisionCandidate } from '../../../src/lib/revision/types'
import { createFixture, removeFixture, type Fixture } from '../extract/fixture'

const { hasSeriesConfig, config: reportConfig } = tryLoadReportConfig()

function edit(
  id: string,
  start: number,
  end: number,
  before: string,
  after: string
): RevisionCandidate {
  return { id, start, end, before, after, targetList: ['m'] }
}

describe('spliceString', () => {
  test('replaces by offset, right to left', () => {
    expect(spliceString('abcdef', [edit('a', 0, 2, 'ab', 'X'), edit('b', 4, 6, 'ef', 'YY')])).toBe(
      'XcdYY'
    )
  })

  test('rejects a bad range, an overlap and a fragment mismatch', () => {
    expect(() => spliceString('abc', [edit('a', 1, 9, 'bc', 'x')])).toThrow('bad range')
    expect(() =>
      spliceString('abcdef', [edit('a', 0, 3, 'abc', 'x'), edit('b', 2, 5, 'cde', 'y')])
    ).toThrow('overlap')
    expect(() => spliceString('abc', [edit('a', 0, 2, 'zz', 'x')])).toThrow('fragment mismatch')
  })
})

describe('buildScopeFile', () => {
  const fixture = createFixture()
  afterAll(() => removeFixture(fixture))

  const scopeFile = ['# 見出し', '', '本文A本文B', '', '---', '', '別の行'].join('\n')
  writeFileSync(join(fixture.config.pathList.editedSource, 'scope-00.md'), scopeFile, 'utf-8')

  const config: ReportConfig = {
    ...fixture.config,
    scopeList: [{ id: 0, file: 'scope-00.md' }],
  }

  function scope(editList: RevisionCandidate[]): PublishedDiffData {
    const { text } = chapterText(config, 0)
    return {
      version: REVISION_VERSION,
      revisionStatus: 'complete',
      section: 0,
      label: 'はじめに',
      sourceFile: 'scope-00.md',
      sourceHashList: {},
      originalTextSha256: sha256String(text),
      revisedTextSha256: sha256String(applyEdits(text, editList)),
      editList: editList as unknown as PublishedDiffData['editList'],
      metricList: [],
      measurementList: { before: {}, after: {} },
      residualList: [],
      finalReview: {},
    }
  }

  test('splices inside one line and keeps the heading marker, separator and other lines', () => {
    const { text } = chapterText(config, 0)
    const offset = text.indexOf('本文B')
    const data = scope([edit('c1', offset, offset + 3, '本文B', '本文C')])
    const built = buildScopeFile(config, data)
    expect(built.split('\n')).toEqual(['# 見出し', '', '本文A本文C', '', '---', '', '別の行'])
    expect(() => verifyScopeFile(built, data)).not.toThrow()
  })

  test('edits a heading line without touching its marker', () => {
    const { text } = chapterText(config, 0)
    const offset = text.indexOf('見出し')
    const data = scope([edit('c1', offset, offset + 3, '見出し', '新見出し')])
    const built = buildScopeFile(config, data)
    expect(built.split('\n')[0]).toBe('# 新見出し')
    expect(() => verifyScopeFile(built, data)).not.toThrow()
  })

  test('an edit that adds a line keeps the rebuilt file verifiable', () => {
    const { text } = chapterText(config, 0)
    const offset = text.indexOf('本文B')
    const data = scope([edit('c1', offset, offset + 3, '本文B', '\n本文B')])
    const built = buildScopeFile(config, data)
    expect(built.split('\n')).toEqual(['# 見出し', '', '本文A', '本文B', '', '---', '', '別の行'])
    expect(() => verifyScopeFile(built, data)).not.toThrow()
  })

  test('stops when an edit crosses a line boundary', () => {
    const { text } = chapterText(config, 0)
    const offset = text.indexOf('見出し')
    const data = scope([
      edit(
        'c1',
        offset,
        text.indexOf('本文A') + 3,
        text.slice(offset, text.indexOf('本文A') + 3),
        'X'
      ),
    ])
    expect(() => buildScopeFile(config, data)).toThrow('crosses a manuscript line boundary')
  })

  test('verification fails when the rebuilt text does not match the published digest', () => {
    const { text } = chapterText(config, 0)
    const offset = text.indexOf('本文B')
    const data = scope([edit('c1', offset, offset + 3, '本文B', '本文C')])
    const built = buildScopeFile(config, data)
    const wrong: PublishedDiffData = { ...data, revisedTextSha256: sha256String('別の文字列') }
    expect(() => verifyScopeFile(built, wrong)).toThrow('does not match its revisedTextSha256')
  })
})

describe('applyToManuscript', () => {
  let fixture: Fixture | null = null

  afterEach(() => {
    if (fixture !== null) removeFixture(fixture)
    fixture = null
  })

  /**
   * 1スコープ分の最小の公開データを書く。`applyToManuscript`が読むフィールドだけを持たせる。
   *
   * @param config 一時リポジトリの設定。
   * @param scope スコープid。
   * @param editList そのスコープの変更案。
   * @param digest `revisedTextSha256`の差し替え。既定は`editList`を適用した本文のハッシュ。
   */
  function publishScope(
    config: ReportConfig,
    scope: number,
    editList: RevisionCandidate[],
    digest?: string
  ): void {
    const { text } = chapterText(config, scope)
    saveJson(diffDataPath(config, scope), {
      version: REVISION_VERSION,
      section: scope,
      editList,
      revisedTextSha256: digest ?? sha256String(applyEdits(text, editList)),
    })
  }

  /**
   * スコープ本文の語を1つ置き換える変更案。
   *
   * @param config 一時リポジトリの設定。
   * @param scope スコープid。
   * @param before 置き換える語（そのスコープ本文に1度だけ現れるもの）。
   * @param after 置き換えたあとの語。
   * @returns 変更案1件。
   */
  function replacement(
    config: ReportConfig,
    scope: number,
    before: string,
    after: string
  ): RevisionCandidate {
    const { text } = chapterText(config, scope)
    const offset = text.indexOf(before)
    return edit(`c${scope}`, offset, offset + before.length, before, after)
  }

  /**
   * 2スコープ分の公開データを書いた一時リポジトリを用意する。
   *
   * @returns 一時リポジトリと出力先ディレクトリのパス（まだ作らない）。
   */
  function setup(): { config: ReportConfig; outDir: string } {
    fixture = createFixture()
    const { config } = fixture
    publishScope(config, 0, [replacement(config, 0, 'からだ', 'カラダ')])
    publishScope(config, 1, [replacement(config, 1, '大切', 'たいせつ')])
    return { config, outDir: join(fixture.root, 'out') }
  }

  test('writes one file per scope into the output directory', () => {
    const { config, outDir } = setup()
    const result = applyToManuscript(config, outDir)
    expect(result.scopes).toBe(2)
    expect(result.written).toEqual([join(outDir, 'scope-00.md'), join(outDir, 'scope-01.md')])
    expect(readFileSync(join(outDir, 'scope-00.md'), 'utf-8')).toContain('カラダ')
    expect(readFileSync(join(outDir, 'scope-01.md'), 'utf-8')).toContain('たいせつ')
  })

  test('writes nothing at all when a later scope fails verification', () => {
    const { config, outDir } = setup()
    publishScope(
      config,
      1,
      [replacement(config, 1, '大切', 'たいせつ')],
      sha256String('別の文字列')
    )
    expect(() => applyToManuscript(config, outDir)).toThrow('does not match its revisedTextSha256')
    expect(existsSync(outDir)).toBe(false)
  })

  test('stops when --out is the edited source directory itself', () => {
    const { config } = setup()
    expect(() => applyToManuscript(config, config.pathList.editedSource)).toThrow(
      'must not overwrite the edited source directory'
    )
  })

  test('stops when --out is a symbolic link to the edited source directory', () => {
    const { config, outDir } = setup()
    symlinkSync(config.pathList.editedSource, outDir)
    expect(() => applyToManuscript(config, outDir)).toThrow(
      'must not overwrite the edited source directory'
    )
    expect(readFileSync(join(config.pathList.editedSource, 'scope-00.md'), 'utf-8')).not.toContain(
      'カラダ'
    )
  })

  test('stops when a scope file escapes its directory with ..', () => {
    const { config, outDir } = setup()
    const escaping: ReportConfig = {
      ...config,
      scopeList: [{ id: 0, file: '../book/scope-00.md' }],
    }
    expect(() => applyToManuscript(escaping, outDir)).toThrow('must stay inside its directory')
    expect(existsSync(outDir)).toBe(false)
  })

  test('stops when the output directory already holds a symbolic link', () => {
    const { config, outDir } = setup()
    mkdirSync(outDir, { recursive: true })
    symlinkSync(join(config.pathList.editedSource, 'scope-00.md'), join(outDir, 'scope-00.md'))
    expect(() => applyToManuscript(config, outDir)).toThrow('already holds a symbolic link')
    expect(readFileSync(join(config.pathList.editedSource, 'scope-00.md'), 'utf-8')).not.toContain(
      'カラダ'
    )
    expect(existsSync(join(outDir, 'scope-01.md'))).toBe(false)
  })
})

describe.skipIf(!hasSeriesConfig)('the published diff data of this repository', () => {
  const config = reportConfig
  const scopeList = hasSeriesConfig
    ? config.scopeList.map(entry => entry.id).sort((a, b) => a - b)
    : []
  const hasSources =
    hasSeriesConfig && scopeList.every(scope => existsSync(scopeSourcePath(config, scope)))

  test.if(hasSources)('every scope reproduces its own original and revised digests', () => {
    for (const scope of scopeList) {
      const data = loadDiffData(config, scope) as unknown as PublishedDiffData
      const { text } = chapterText(config, scope)
      expect(sha256String(text)).toBe(data.originalTextSha256)
      const revised = applyEdits(text, data.editList as unknown as RevisionCandidate[])
      expect(sha256String(revised)).toBe(data.revisedTextSha256)
    }
  })

  test.if(hasSources)('rebuilding every scope file verifies against its published digest', () => {
    for (const scope of scopeList) {
      const data = loadDiffData(config, scope) as unknown as PublishedDiffData
      expect(() => verifyScopeFile(buildScopeFile(config, data), data)).not.toThrow()
    }
  })

  test('every scope is complete, approved for exactly the text it published, and improved', () => {
    for (const scope of scopeList) {
      const data = loadDiffData(config, scope) as unknown as PublishedDiffData
      expect(data.version).toBe(REVISION_VERSION)
      expect(data.revisionStatus).toBe('complete')
      expect(data.finalReview.verdict).toBe('approved')
      expect(data.finalReview.revisedSha256).toBe(data.revisedTextSha256)

      const targetList = data.metricList.filter(metric => metric.target)
      const addressed = new Set(data.editList.map(entry => entry.target as string))
      for (const metric of targetList) {
        if (!addressed.has(metric.path)) continue
        expect(Math.abs(metric.after - metric.model)).toBeLessThanOrEqual(
          Math.abs(metric.before - metric.model) + 1e-10
        )
      }
      if (data.editList.length > 0) {
        expect(
          targetList.some(
            metric =>
              Math.abs(metric.after - metric.model) < Math.abs(metric.before - metric.model) - 1e-10
          )
        ).toBe(true)
      }
    }
  })
})
