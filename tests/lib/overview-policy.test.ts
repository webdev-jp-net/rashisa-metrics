import { describe, expect, test } from 'bun:test'
import { classify, makeSummary, movement } from '@/lib/policy/overview-policy'
import type { MakeSummaryCriterion, MakeSummaryDataset } from '@/lib/policy/overview-policy'

// Ports tests/test_overview_policy.py's assertions exactly.

describe('classify', () => {
  test('boundaries', () => {
    expect(classify(0.9, 7)).toBe('close')
    expect(classify(0.9, 8)).toBe('targeted')
    expect(classify(0.88, 9)).toBe('targeted')
    expect(classify(0.879, 5)).toBe('priority')
    expect(classify(0.95, 10)).toBe('priority')
  })
})

describe('movement', () => {
  test('directions', () => {
    expect(movement('文法語', '終助詞', -0.2)).toBe('終助詞の比率を上げる')
    expect(movement('文法語', '終助詞', 0.2)).toBe('終助詞の比率を下げる')
    expect(movement('段落長', '中央値', 20)).toBe('段落長の中央値を短くする')
  })
})

describe('makeSummary', () => {
  test('another chapter changing classification does not change an unrelated chapter selection', () => {
    const data: MakeSummaryDataset[] = [0, 1, 2].map(() => ({
      lsm: { mean: 0.85, categoryList: [{ label: '終助詞', lsm: 0.6 }] },
    }))
    const labelList = ['全体', '対象章', '別章']
    const criteria: MakeSummaryCriterion[] = [
      {
        group: '文法語',
        item: '終助詞',
        counted: true,
        limit: 0.1,
        valueList: [-0.2, -0.3, -0.4],
        flaggedRowList: [0, 1, 2],
      },
    ]
    // Python: `_, before = make_summary(...)` — the second return value is `assessmentList`
    // (per-chapter records), not `noteList`; the test compares those, keyed to '対象章' (row 1).
    const before = makeSummary(data, labelList, [1, 1, 1], criteria, 'お手本')
    const changed = structuredClone(data)
    changed[2].lsm.mean = 0.99
    const after = makeSummary(changed, labelList, [1, 1, 0], criteria, 'お手本')
    expect(before.assessmentList[0]).toEqual(after.assessmentList[0])
  })
})
