/**
 * Ports test_revision_metrics.py's metric_specs assertions. These run against the real stored
 * overview_criteria.json, which is generated data (no manuscript text).
 */
import { describe, expect, test } from 'bun:test'
import { tryLoadReportConfig } from '../../../src/lib/config/report-config'
import { loadOverviewCriteria, type OverviewCriteria } from '../../../src/lib/data/report-data'
import { getPath, getValue, metricSpecList } from '../../../src/lib/revision/metric-specs'

const { hasSeriesConfig, config } = tryLoadReportConfig()
const overview = hasSeriesConfig
  ? loadOverviewCriteria(config)
  : (undefined as unknown as OverviewCriteria)
const idList = hasSeriesConfig ? config.scopeList.map(scope => scope.id).sort((a, b) => a - b) : []

describe.skipIf(!hasSeriesConfig)('metricSpecs', () => {
  test('maps all 26 columns and uses the scope row', () => {
    const specList = metricSpecList(overview, 0, idList)
    expect(specList.length).toBe(26)
    // Column 0 is the excluded LSM mean, so the first spec comes from column 1, row 1 (scope 0).
    expect(specList[0]!.before).toBe(
      overview.columnList[1]!.model! + overview.columnList[1]!.valueList[1]!
    )
    expect(specList.some(spec => spec.label.endsWith('平均LSM'))).toBe(false)
    expect(specList.some(spec => spec.label.endsWith('合計'))).toBe(false)
    expect(metricSpecList(overview, 9, idList).length).toBe(26)
  })

  test('keeps the scope row: scope 9 reads valueList[10]', () => {
    const specList = metricSpecList(overview, 9, idList)
    expect(specList[0]!.before).toBe(
      overview.columnList[1]!.model! + overview.columnList[1]!.valueList[10]!
    )
    const flagged = overview.columnList[1]!.flaggedRowList.includes(10)
    expect(specList[0]!.standout).toBe(flagged)
  })

  test('ratio groups are scaled to percent, other groups keep their own unit', () => {
    const specList = metricSpecList(overview, 0, idList)
    for (const spec of specList) {
      const isRatio = spec.group === '文法語' || spec.group === '文末'
      expect(spec.scale).toBe(isRatio ? 100 : 1)
      expect(spec.unit).toBe(isRatio ? '%' : spec.unit)
      expect(spec.id).toBe(spec.path)
      expect(spec.label).toContain('・')
    }
    expect(specList.filter(spec => spec.group === '文法語').length).toBe(10)
    expect(specList.filter(spec => spec.group === '文末').length).toBe(7)
    expect(specList.filter(spec => spec.group === '丁寧度').length).toBe(3)
    expect(specList.filter(spec => spec.group === '文長').length).toBe(3)
    expect(specList.filter(spec => spec.group === '段落長').length).toBe(3)
  })

  test('an unknown column fails', () => {
    const broken: OverviewCriteria = {
      ...overview,
      columnList: [
        ...overview.columnList,
        { ...overview.columnList[1]!, group: '未知', item: '値' },
      ],
    }
    expect(() => metricSpecList(broken, 0, idList)).toThrow('Unknown overview column')
  })

  test('a duplicated column fails', () => {
    const broken: OverviewCriteria = {
      ...overview,
      columnList: [...overview.columnList, overview.columnList[1]!],
    }
    expect(() => metricSpecList(broken, 0, idList)).toThrow('Duplicate overview column')
  })

  test('a scope outside the configured ids fails', () => {
    const outside = Math.max(...idList) + 1
    expect(() => metricSpecList(overview, outside, idList)).toThrow(
      `scope must be one of ${idList.join(',')}`
    )
    expect(() => metricSpecList(overview, -1, idList)).toThrow(
      `scope must be one of ${idList.join(',')}`
    )
  })

  test('the scope ids must match the scope rows of labelList, not a fixed count', () => {
    const shrunk: OverviewCriteria = { ...overview, labelList: overview.labelList.slice(0, 4) }
    expect(metricSpecList(shrunk, 2, [0, 1, 2]).length).toBe(26)
    expect(() => metricSpecList(shrunk, 3, [0, 1, 2])).toThrow('scope must be one of 0,1,2')
    expect(() => metricSpecList(shrunk, 2, idList)).toThrow('scope rows')
  })

  test('non-consecutive ids read the row at their position in the ascending id list', () => {
    const shiftedIdList = idList.map(id => id * 10 + 5)
    const shifted = metricSpecList(overview, shiftedIdList[9]!, shiftedIdList)
    expect(shifted[0]!.before).toBe(
      overview.columnList[1]!.model! + overview.columnList[1]!.valueList[10]!
    )
    expect(shifted).toEqual(metricSpecList(overview, idList[9]!, idList))
  })
})

describe('getValue', () => {
  const profile = {
    lsmCategory: { ratioList: { quantifiers: 0.0123 } },
    sentence: { lengthDist: { mean: 40 } },
  }

  test('applies the spec scale', () => {
    expect(
      getValue(profile, { path: 'lsmCategory.ratioList.quantifiers', scale: 100 })
    ).toBeCloseTo(1.23, 10)
    expect(getValue(profile, { path: 'sentence.lengthDist.mean', scale: 1 })).toBe(40)
  })

  test('a missing path throws with the path as the message', () => {
    expect(() => getPath(profile, 'politeness.teineigoPer1000Morph')).toThrow(
      'politeness.teineigoPer1000Morph'
    )
  })
})
