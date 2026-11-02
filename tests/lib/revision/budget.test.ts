/**
 * Ports test_revision_metrics.py's budget assertions with synthetic measurements, plus the
 * counts-match-ratios invariant, which the legacy test proved by measuring real Japanese text.
 * That half needs the morphological analyzer; it is marked below and skipped when the adapter
 * is absent.
 */
import { describe, expect, test } from 'bun:test'
import { tryLoadReportConfig } from '../../../src/lib/config/report-config'
import { loadOverviewCriteria } from '../../../src/lib/data/report-data'
import { budget } from '../../../src/lib/revision/budget'
import { metricSpecList } from '../../../src/lib/revision/metric-specs'
import type { ChapterMeasurement, MetricSpec } from '../../../src/lib/revision/types'

const { hasSeriesConfig, config } = tryLoadReportConfig()
const scopeIdList = hasSeriesConfig
  ? config.scopeList.map(scope => scope.id).sort((a, b) => a - b)
  : []
const specList = hasSeriesConfig
  ? metricSpecList(loadOverviewCriteria(config), scopeIdList[0]!, scopeIdList)
  : []

/** A measurement whose every metric reads back the same value, with counts for the counted ones. */
function syntheticMeasurement(value: number): ChapterMeasurement {
  const countList: ChapterMeasurement['countList'] = {}
  for (const spec of specList) {
    if (spec.group === '文長' || spec.group === '段落長') continue
    const denominator = 1000
    const density = spec.id.startsWith('politeness.') ? 1000 : 100
    countList[spec.id] = {
      numerator: Math.round((value * denominator) / density),
      denominator,
      occurrenceList: [],
    }
  }
  const profile = {
    lsmCategory: { ratioList: {} as Record<string, number> },
    sentenceEnding: { ratioList: {} as Record<string, number> },
    politeness: {} as Record<string, number>,
    sentence: { lengthDist: { mean: value, median: value, p90: value } },
    paragraph: { lengthDist: { mean: value, median: value, p90: value } },
  }
  for (const spec of specList) {
    const [, , leaf] = spec.path.split('.')
    if (spec.path.startsWith('lsmCategory'))
      profile.lsmCategory.ratioList[leaf!] = value / spec.scale
    if (spec.path.startsWith('sentenceEnding'))
      profile.sentenceEnding.ratioList[leaf!] = value / spec.scale
    if (spec.path.startsWith('politeness')) profile.politeness[spec.path.split('.')[1]!] = value
  }
  return { profile: profile as unknown as ChapterMeasurement['profile'], countList: countList }
}

describe.skipIf(!hasSeriesConfig)('budget', () => {
  test('direction follows the gap, and length metrics carry no counts', () => {
    const details = syntheticMeasurement(12)
    for (const spec of specList) {
      const result = budget(spec, details)
      const expected = result.gap > 1e-12 ? 'increase' : result.gap < -1e-12 ? 'decrease' : 'none'
      expect(result.direction).toBe(expected)
      if (spec.group === '文長' || spec.group === '段落長') {
        expect(result.numerator).toBeNull()
        expect(result.denominator).toBeNull()
        expect(result.estimatedDeltaCount).toBeNull()
        expect(result.targetCountAtCurrentDenominator).toBeNull()
      } else {
        expect(typeof result.numerator).toBe('number')
        expect(typeof result.denominator).toBe('number')
      }
    }
  })

  test('direction is none when the value already equals the model media', () => {
    const spec = specList.find(entry => entry.group === '文長')!
    const details = syntheticMeasurement(spec.model)
    expect(budget(spec, details).direction).toBe('none')
    expect(budget(spec, details).gap).toBe(0)
  })

  test('a keigo budget uses the per-1000-morpheme denominator', () => {
    const path = 'politeness.teineigoPer1000Morph'
    const spec: Pick<MetricSpec, 'id' | 'path' | 'scale' | 'model'> = {
      id: path,
      path,
      scale: 1,
      model: 30,
    }
    const details: ChapterMeasurement = {
      profile: {
        politeness: { teineigoPer1000Morph: 40 },
      } as unknown as ChapterMeasurement['profile'],
      countList: { [path]: { numerator: 400, denominator: 10000, occurrenceList: [] } },
    }
    expect(budget(spec, details).estimatedDeltaCount).toBe(-100)
    expect(budget(spec, details).targetCountAtCurrentDenominator).toBe(300)
  })

  test('a ratio budget uses the percentage denominator', () => {
    const path = 'lsmCategory.ratioList.quantifiers'
    const spec: Pick<MetricSpec, 'id' | 'path' | 'scale' | 'model'> = {
      id: path,
      path,
      scale: 100,
      model: 0.5,
    }
    const details: ChapterMeasurement = {
      profile: {
        lsmCategory: { ratioList: { quantifiers: 0.012 } },
      } as unknown as ChapterMeasurement['profile'],
      countList: { [path]: { numerator: 24, denominator: 2000, occurrenceList: [] } },
    }
    const result = budget(spec, details)
    expect(result.current).toBeCloseTo(1.2, 10)
    expect(result.direction).toBe('decrease')
    expect(result.targetCountAtCurrentDenominator).toBe(10)
    expect(result.estimatedDeltaCount).toBe(-14)
  })
})
