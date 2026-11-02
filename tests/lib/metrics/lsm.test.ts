/**
 * lsmCategoryOccurrences unit tests against synthetic (non-manuscript) token arrays, covering
 * every category's matching rule (posFilter, extraLemmaList, lemmaList) and the かもしれない
 * modal-negation exclusion (both the ます and non-ます variants, and the cross-document guard).
 */
import { describe, expect, test } from 'bun:test'
import { lsmCategoryOccurrenceList, loadLsmConfig } from '../../../src/lib/metrics'
import type { Token } from '../../../src/lib/morph'

const lsmCfg = loadLsmConfig()

function tok(overrides: Partial<Token> & Pick<Token, 'surface' | 'pos1' | 'lemma'>): Token {
  return { pos2: '*', document: 0, ...overrides }
}

describe('lsmCategoryOccurrences: one matching token per category', () => {
  // Index in this array is what the assertions below check against.
  const tokenList: Token[] = [
    tok({ surface: '私', pos1: '代名詞', lemma: '私' }), // 0: pronouns (posFilter ["代名詞"])
    tok({ surface: 'が', pos1: '助詞', pos2: '格助詞', lemma: 'が' }), // 1: caseParticles
    tok({ surface: 'は', pos1: '助詞', pos2: '係助詞', lemma: 'は' }), // 2: bindingParticles via posFilter
    tok({ surface: 'だけ', pos1: '助詞', pos2: '副助詞', lemma: 'だけ' }), // 3: bindingParticles via extraLemmaList
    tok({ surface: 'ので', pos1: '助詞', pos2: '接続助詞', lemma: 'ので' }), // 4: conjunctiveParticles
    tok({ surface: 'ね', pos1: '助詞', pos2: '終助詞', lemma: 'ね' }), // 5: finalParticles
    tok({ surface: 'そして', pos1: '接続詞', lemma: 'そして' }), // 6: conjunctions
    tok({ surface: 'ゆっくり', pos1: '副詞', lemma: 'ゆっくり' }), // 7: adverbs
    tok({ surface: 'です', pos1: '助動詞', lemma: 'です' }), // 8: auxiliaries only
    tok({ surface: 'ない', pos1: '助動詞', lemma: 'ない' }), // 9: auxiliaries (pos1) AND negations (lemma)
    tok({ surface: '全部', pos1: '名詞', pos2: '普通名詞', lemma: '全部' }), // 10: quantifiers via lemma, no posFilter
    tok({ surface: 'これ', pos1: '名詞', pos2: '代名詞', lemma: 'これ' }), // 11: filler — 名詞/代名詞 must NOT satisfy pronouns' pos1==="代名詞" filter
  ]
  const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)

  test('posFilter categories match on pos1 (and pos2 when the filter has two elements)', () => {
    expect(occurrenceList.pronouns).toEqual([0])
    expect(occurrenceList.caseParticles).toEqual([1])
    expect(occurrenceList.conjunctiveParticles).toEqual([4])
    expect(occurrenceList.finalParticles).toEqual([5])
    expect(occurrenceList.conjunctions).toEqual([6])
    expect(occurrenceList.adverbs).toEqual([7])
    expect(occurrenceList.auxiliaries).toEqual([8, 9])
  })

  test('bindingParticles matches both its posFilter and its extraLemmaList', () => {
    expect(occurrenceList.bindingParticles).toEqual([2, 3])
  })

  test('negations matches by lemma alone, independent of posFilter categories', () => {
    expect(occurrenceList.negations).toEqual([9])
  })

  test('quantifiers matches by lemma alone, with no posFilter at all', () => {
    expect(occurrenceList.quantifiers).toEqual([10])
  })

  test('a 名詞/代名詞 token does not satisfy pronouns (which requires pos1 === 代名詞)', () => {
    expect(occurrenceList.pronouns).not.toContain(11)
  })
})

describe('lsmCategoryOccurrences: かもしれない modal-negation exclusion', () => {
  test('non-ます variant: the trailing negation auxiliary is excluded from negations', () => {
    const tokenList: Token[] = [
      tok({ surface: '晴れる', pos1: '動詞', lemma: '晴れる' }),
      tok({ surface: 'か', pos1: '助詞', lemma: 'か' }),
      tok({ surface: 'も', pos1: '助詞', lemma: 'も' }),
      tok({ surface: 'しれ', pos1: '動詞', lemma: 'しれる' }),
      tok({ surface: 'ない', pos1: '助動詞', lemma: 'ない' }),
    ]
    const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
    expect(occurrenceList.negations).toEqual([])
  })

  test('ます variant: ます is skipped over and the trailing negation is still excluded', () => {
    const tokenList: Token[] = [
      tok({ surface: '晴れる', pos1: '動詞', lemma: '晴れる' }),
      tok({ surface: 'か', pos1: '助詞', lemma: 'か' }),
      tok({ surface: 'も', pos1: '助詞', lemma: 'も' }),
      tok({ surface: 'しれ', pos1: '動詞', lemma: 'しれる' }),
      tok({ surface: 'ます', pos1: '助動詞', lemma: 'ます' }),
      tok({ surface: 'ん', pos1: '助動詞', lemma: 'ぬ' }),
    ]
    const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
    expect(occurrenceList.negations).toEqual([])
  })

  test('知れる (alternate kanji) also triggers the exclusion', () => {
    const tokenList: Token[] = [
      tok({ surface: 'か', pos1: '助詞', lemma: 'か' }),
      tok({ surface: 'も', pos1: '助詞', lemma: 'も' }),
      tok({ surface: '知れ', pos1: '動詞', lemma: '知れる' }),
      tok({ surface: 'ず', pos1: '助動詞', lemma: 'ず' }),
    ]
    const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
    expect(occurrenceList.negations).toEqual([])
  })

  test('cross-document guard: a construction split across documents is not excluded (the negation still counts)', () => {
    // 「しれる」 belongs to a different document than 「か」「も」— the tail[:4] same-document
    // check fails, so this never becomes a candidate at all.
    const tokenList: Token[] = [
      tok({ surface: 'か', pos1: '助詞', lemma: 'か', document: 0 }),
      tok({ surface: 'も', pos1: '助詞', lemma: 'も', document: 0 }),
      tok({ surface: 'しれ', pos1: '動詞', lemma: 'しれる', document: 1 }),
      tok({ surface: 'ない', pos1: '助動詞', lemma: 'ない', document: 1 }),
    ]
    const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
    expect(occurrenceList.negations).toEqual([3])
  })

  test('cross-document guard: the negation token itself in a different document is not excluded', () => {
    // 「か」「も」「しれる」 are all document 0 (the tail[:4] check passes), but the trailing
    // negation auxiliary is document 1 — the final same-document check fails, so it still counts.
    const tokenList: Token[] = [
      tok({ surface: 'か', pos1: '助詞', lemma: 'か', document: 0 }),
      tok({ surface: 'も', pos1: '助詞', lemma: 'も', document: 0 }),
      tok({ surface: 'しれ', pos1: '動詞', lemma: 'しれる', document: 0 }),
      tok({ surface: 'ない', pos1: '助動詞', lemma: 'ない', document: 1 }),
    ]
    const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
    expect(occurrenceList.negations).toEqual([3])
  })

  test('an unrelated ない elsewhere in the same tokens is still counted as a negation', () => {
    const tokenList: Token[] = [
      tok({ surface: '晴れる', pos1: '動詞', lemma: '晴れる' }),
      tok({ surface: 'か', pos1: '助詞', lemma: 'か' }),
      tok({ surface: 'も', pos1: '助詞', lemma: 'も' }),
      tok({ surface: 'しれ', pos1: '動詞', lemma: 'しれる' }),
      tok({ surface: 'ない', pos1: '助動詞', lemma: 'ない' }), // excluded (index 4)
      tok({ surface: '。', pos1: '補助記号', lemma: '。' }),
      tok({ surface: '知ら', pos1: '動詞', lemma: '知る' }),
      tok({ surface: 'ない', pos1: '助動詞', lemma: 'ない' }), // unrelated, still counted (index 7)
    ]
    const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
    expect(occurrenceList.negations).toEqual([7])
  })
})
