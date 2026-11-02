/**
 * Block splitting, target ordering and the input-hash map. All synthetic except the hash map,
 * which is checked against the repository's own files.
 */
import { join, relative } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { scopeSourcePath, tryLoadReportConfig } from '../../../src/lib/config/report-config'
import { sha256File } from '../../../src/lib/data/json-io'
import { chapterProfilePath, modelProfilePath } from '../../../src/lib/data/profiles'
import { comparisonChapterPath, overviewCriteriaPath } from '../../../src/lib/data/report-data'
import { sourceHashInputList, sourceHashList } from '../../../src/lib/revision/hashes'
import { blockListOf, orderTargetList } from '../../../src/lib/revision/plan'
import type { MetricSpec } from '../../../src/lib/revision/types'

const { hasSeriesConfig, config } = tryLoadReportConfig()

describe('blocksOf', () => {
  test('numbers one block per paragraph and keeps its offsets', () => {
    const text = 'one\ntwo\n\nthree\n\n\nfour'
    const blockList = blockListOf(text)
    expect(blockList.map(block => block.id)).toEqual(['p001', 'p002', 'p003'])
    expect(blockList.map(block => block.text)).toEqual(['one\ntwo', 'three', 'four'])
    for (const block of blockList) {
      expect(text.slice(block.start, block.end)).toBe(block.text)
    }
  })

  test('ignores trailing and indented blank lines between blocks', () => {
    const blockList = blockListOf('alpha\n  \nbeta')
    expect(blockList.map(block => block.text)).toEqual(['alpha', 'beta'])
  })

  test('an empty or blank text has no blocks', () => {
    expect(blockListOf('')).toEqual([])
    expect(blockListOf('\n \n')).toEqual([])
  })
})

describe('orderTargets', () => {
  function spec(
    id: string,
    before: number,
    model: number,
    limit: number,
    standout = true
  ): MetricSpec {
    return {
      id,
      path: id,
      label: id,
      group: '文法語',
      unit: '%',
      scale: 100,
      model,
      before,
      limit,
      standout,
    }
  }

  test('orders standout targets by distance relative to their limit, then by id', () => {
    const specList = [
      spec('b', 12, 10, 1), // 2.0 limits away
      spec('a', 14, 10, 1), // 4.0 limits away
      spec('c', 5, 10, 10), // 0.5 limits away
      spec('d', 99, 10, 1, false), // not standout
      spec('e', 14, 10, 1), // ties with 'a', ordered by id
    ]
    expect(orderTargetList(specList).map(entry => entry.id)).toEqual(['a', 'e', 'b', 'c'])
  })

  test('drops metrics that are not standout', () => {
    expect(orderTargetList([spec('x', 12, 10, 1, false)])).toEqual([])
  })
})

describe.skipIf(!hasSeriesConfig)('sourceHashes', () => {
  const repoRelative = (path: string) => relative(config.root, path)

  test('covers the scope source file, profiles, evidence, measurement modules and setting', () => {
    const hashList = sourceHashList(config, 1)
    const keyList = Object.keys(hashList)
    expect(keyList).toContain(repoRelative(scopeSourcePath(config, 1)))
    expect(keyList).toContain(repoRelative(modelProfilePath(config)))
    expect(keyList).toContain(repoRelative(chapterProfilePath(config, 1)))
    expect(keyList).toContain(
      repoRelative(join(config.pathList.modelProfile, 'exemplar_bank.jsonl'))
    )
    expect(keyList).toContain(
      repoRelative(join(config.pathList.modelProfile, 'author_writing_sheet.md'))
    )
    expect(keyList).toContain(repoRelative(overviewCriteriaPath(config)))
    expect(keyList).toContain(repoRelative(comparisonChapterPath(config, 1)))
    expect(keyList).toContain('src/lib/metrics/measure.ts')
    expect(keyList).toContain('src/lib/text/anonymize.ts')
    expect(keyList).toContain(repoRelative(config.pathList.lsmCategories))
    expect(keyList).toContain(repoRelative(config.pathList.keigoLexicon))
    expect(keyList).toContain('config/report.json')
    for (const value of Object.values(hashList)) expect(value).toMatch(/^[0-9a-f]{64}$/)
  })

  test('every key is repo-relative and every value is that file s digest', () => {
    const hashList = sourceHashList(config, 3)
    const inputList = sourceHashInputList(config, 3)
    expect(Object.keys(hashList).length).toBe(inputList.length)
    for (const key of Object.keys(hashList)) {
      expect(key.startsWith('/')).toBe(false)
      expect(hashList[key]).toBe(sha256File(`${config.root}/${key}`))
    }
  })

  test('the scope only changes the source file, chapter profile and comparison entries', () => {
    const one = sourceHashList(config, 1)
    const two = sourceHashList(config, 2)
    const changed = Object.keys(one)
      .filter(key => one[key] !== two[key] || !(key in two))
      .concat(Object.keys(two).filter(key => !(key in one)))
    expect(changed.sort()).toEqual(
      [
        repoRelative(scopeSourcePath(config, 1)),
        repoRelative(scopeSourcePath(config, 2)),
        repoRelative(chapterProfilePath(config, 1)),
        repoRelative(chapterProfilePath(config, 2)),
        repoRelative(comparisonChapterPath(config, 1)),
        repoRelative(comparisonChapterPath(config, 2)),
      ].sort()
    )
  })
})
