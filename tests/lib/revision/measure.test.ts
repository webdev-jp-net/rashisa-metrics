/**
 * Ports test_revision_metrics.py's measure_details assertions: every count exposed behind a ratio
 * metric must reproduce that metric's value in the profile.
 *
 * The sentence-ending half needs no morphology and runs with NullTokenizer. The LSM and keigo
 * halves need a real analyzer: they run only when src/lib/morph/lindera-unidic.ts is present, and
 * report why they were skipped otherwise. The text below is synthetic — no manuscript content.
 */
import { describe, expect, test } from 'bun:test'
import { tryLoadReportConfig } from '../../../src/lib/config/report-config'
import { measureDetail } from '../../../src/lib/metrics/details'
import { roundHalfEven } from '../../../src/lib/metrics/round'
import { NullTokenizer, type Tokenizer } from '../../../src/lib/morph'
import { measureChapter } from '../../../src/lib/revision/measure'

const SAMPLE =
  'これは文章です。多く進みますね。次の段落です。かもしれません。行かないかもしれない。'.repeat(30)

const { hasSeriesConfig, config } = tryLoadReportConfig()

let lindera: Tokenizer | null = null
let linderaError = ''
try {
  const module = await import('../../../src/lib/morph/lindera-unidic')
  lindera = module.createLinderaUnidicTokenizer()
} catch (error) {
  linderaError = String(error)
}

if (lindera === null) {
  console.warn(
    `[revision] token-dependent measurement assertions skipped: the lindera adapter is not usable (${linderaError})`
  )
}

describe('measureDetail counts behind each metric', () => {
  test('sentence-ending counts reproduce the profile ratios (no morphology needed)', () => {
    const details = measureDetail(SAMPLE, NullTokenizer)
    const ratioList = details.profile.sentenceEnding.ratioList as unknown as Record<string, number>
    for (const [path, count] of Object.entries(details.countList)) {
      if (!path.startsWith('sentenceEnding')) continue
      const label = path.split('.').at(-1)!
      expect(ratioList[label]).toBeCloseTo(roundHalfEven(count.numerator / count.denominator, 6), 9)
    }
  })

  test.if(lindera !== null)('every count reproduces its profile value', () => {
    const details = measureDetail(SAMPLE, lindera!)
    for (const [path, count] of Object.entries(details.countList)) {
      const leaf = path.split('.').at(-1)!
      if (path.startsWith('lsmCategory')) {
        const ratioList = details.profile.lsmCategory!.ratioList
        expect(ratioList[leaf]).toBeCloseTo(
          roundHalfEven(count.numerator / count.denominator, 6),
          9
        )
      } else if (path.startsWith('sentenceEnding')) {
        const ratioList = details.profile.sentenceEnding.ratioList as unknown as Record<
          string,
          number
        >
        expect(ratioList[leaf]).toBeCloseTo(
          roundHalfEven(count.numerator / count.denominator, 6),
          9
        )
      } else {
        expect(details.profile.politeness![leaf]).toBeCloseTo(
          roundHalfEven((count.numerator / count.denominator) * 1000, 3),
          9
        )
      }
    }
  })
})

describe.skipIf(!hasSeriesConfig)('measureChapter', () => {
  test('records which anonymization produced the numbers', () => {
    const { profile } = measureChapter(SAMPLE, { config, tokenizer: NullTokenizer })
    const sanitization = (profile.measurement as unknown as Record<string, unknown>)
      .sanitization as Record<string, unknown>
    expect(sanitization.version).toBe('basic-pii-and-terms-v1')
    expect(sanitization.termListHash).toMatch(/^[0-9a-f]{64}$/)
    expect(sanitization.nonPiiExceptionList).toEqual(
      [...config.anonymization.edited.exceptionList].sort()
    )
    expect(Object.keys(sanitization)).toEqual(['version', 'termListHash', 'nonPiiExceptionList'])
  })

  test('measures the anonymized text, not the raw text', () => {
    const term = config.anonymization.edited.termList[0]!
    const withTerm = `${term}はここにいます。次の文です。`
    const withoutTerm = 'はここにいます。次の文です。'
    const ctx = { config, tokenizer: NullTokenizer }
    expect(measureChapter(withTerm, ctx).profile.corpusSize.chars).toBe(
      measureChapter(withoutTerm, ctx).profile.corpusSize.chars
    )
  })
})
