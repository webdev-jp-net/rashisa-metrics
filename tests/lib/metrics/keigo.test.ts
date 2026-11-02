/**
 * keigoCounts unit tests against synthetic (non-manuscript) tokens/strings. Reads the real
 * config/keigo_lexicon.yaml (keigoCounts loads it internally, mirroring lexicons.py's
 * module-level KEIGO global rather than taking the lexicon as a parameter).
 */
import { describe, expect, test } from 'bun:test'
import { keigoCountList } from '../../../src/lib/metrics'

describe('keigoCountList: lemma matches (surfacePatternList absent from the text)', () => {
  test('counts one hit per matching lemma, per category, ignoring non-matching lemmas', () => {
    const tokenList = [
      { lemma: 'いらっしゃる' }, // sonkeigo
      { lemma: 'おっしゃる' }, // sonkeigo
      { lemma: '伺う' }, // kenjougo
      { lemma: '申す' }, // kenjougo
      { lemma: 'です' }, // teineigo
      { lemma: 'ます' }, // teineigo
      { lemma: 'ございます' }, // teineigo
      { lemma: '食べる' }, // filler, matches nothing
    ]
    const hitList = keigoCountList(tokenList, '今日は晴れ')
    expect(hitList).toEqual({ sonkeigo: 2, kenjougo: 2, teineigo: 3 })
  })
})

describe('keigoCountList: surfacePatternList matches (no lexicon lemmas among the tokens)', () => {
  test('counts one hit per matching surface pattern occurrence in the normalized text', () => {
    const tokenList = [{ lemma: '食べる' }, { lemma: '歩く' }]
    const text =
      'お読みになると思います。ご確認ください。お伝えします。させていただきます。よろしくでございます。'
    const hitList = keigoCountList(tokenList, text)
    // sonkeigo: "お読みになる" (になる型) + "ご確認ください" (ください型)
    // kenjougo: "お伝えします" (します型) + "させていただ" (させていただく構文)
    // teineigo: "でございます"
    expect(hitList).toEqual({ sonkeigo: 2, kenjougo: 2, teineigo: 1 })
  })
})

describe('keigoCounts: lemma and surface_pattern hits accumulate together', () => {
  test('a category sums its lemma hits and its surface-pattern hits', () => {
    const tokenList = [{ lemma: 'いらっしゃる' }]
    const hitList = keigoCountList(tokenList, 'ご確認ください')
    expect(hitList.sonkeigo).toBe(2) // 1 lemma hit + 1 pattern hit
    expect(hitList.kenjougo).toBe(0)
    expect(hitList.teineigo).toBe(0)
  })

  test('an empty token list and plain text produce all-zero counts', () => {
    const hitList = keigoCountList([], '普通の文章')
    expect(hitList).toEqual({ sonkeigo: 0, kenjougo: 0, teineigo: 0 })
  })
})
