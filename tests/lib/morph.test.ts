/**
 * createLinderaUnidicTokenizer() against one synthetic sentence — verifies the pos1/pos2/lemma
 * mapping from lindera-wasm-unidic-nodejs's UniDic `details[]` array, and that the resulting
 * tokens feed correctly into lsmCategoryOccurrences (the かもしれません modal-negation exclusion
 * in particular, since it depends on exact lemma values for 動詞/助動詞 tokens).
 */
import { describe, expect, test } from 'bun:test'
import { loadLsmConfig, lsmCategoryOccurrenceList } from '../../src/lib/metrics'
import { createLinderaUnidicTokenizer } from '../../src/lib/morph'

const SENTENCE = '私はそれを少し読まないかもしれません。'

describe('createLinderaUnidicTokenizer', () => {
  const tokenizer = createLinderaUnidicTokenizer()

  test('name identifies the package and dictionary', () => {
    expect(tokenizer.name).toMatch(/^lindera-wasm-unidic-nodejs:\d+\.\d+\.\d+\/unidic$/)
  })

  test('returns the same cached instance on repeat calls', () => {
    expect(createLinderaUnidicTokenizer()).toBe(tokenizer)
  })

  const tokenList = tokenizer.tokenize(SENTENCE, 0)

  test('segments the sentence into the expected surfaces, in order', () => {
    expect(tokenList.map(t => t.surface)).toEqual([
      '私',
      'は',
      'それ',
      'を',
      '少し',
      '読ま',
      'ない',
      'か',
      'も',
      'しれ',
      'ませ',
      'ん',
      '。',
    ])
  })

  test('every token is tagged with the requested document index', () => {
    expect(tokenList.every(t => t.document === 0)).toBe(true)
    expect(tokenizer.tokenize(SENTENCE, 3).every(t => t.document === 3)).toBe(true)
  })

  test('pos1/pos2/lemma mapping for representative tokens', () => {
    const bySurfaceOrder = tokenList
    // 私: 代名詞, no subcategory (details[1] === '*' → pos2 '').
    expect(bySurfaceOrder[0]).toMatchObject({
      surface: '私',
      pos1: '代名詞',
      pos2: '',
      lemma: '私',
    })
    // は: 助詞/係助詞 (two-level posFilter target for bindingParticles).
    expect(bySurfaceOrder[1]).toMatchObject({
      surface: 'は',
      pos1: '助詞',
      pos2: '係助詞',
      lemma: 'は',
    })
    // を: 助詞/格助詞 (caseParticles).
    expect(bySurfaceOrder[3]).toMatchObject({
      surface: 'を',
      pos1: '助詞',
      pos2: '格助詞',
      lemma: 'を',
    })
    // 少し: 副詞, and also an LSM quantifiers lemma.
    expect(bySurfaceOrder[4]).toMatchObject({
      surface: '少し',
      pos1: '副詞',
      pos2: '',
      lemma: '少し',
    })
    // 読ま: 動詞, lemma comes from orthographic_base_form (details[10]) = dictionary form 読む.
    expect(bySurfaceOrder[5]).toMatchObject({ surface: '読ま', pos1: '動詞', lemma: '読む' })
    // ない: 助動詞, lemma ない — a genuine negation (not part of the modal construction).
    expect(bySurfaceOrder[6]).toMatchObject({
      surface: 'ない',
      pos1: '助動詞',
      pos2: '',
      lemma: 'ない',
    })
    // しれ: 動詞, lemma しれる (details[10]) — matches lsm.ts's MODAL_LEMMAS.
    expect(bySurfaceOrder[9]).toMatchObject({ surface: 'しれ', pos1: '動詞', lemma: 'しれる' })
    // ん: 助動詞, lemma ぬ (details[10]) — the modal-negation auxiliary that must be excluded.
    expect(bySurfaceOrder[11]).toMatchObject({ surface: 'ん', pos1: '助動詞', lemma: 'ぬ' })
  })

  test('lsmCategoryOccurrences excludes the かもしれません negation but keeps the standalone ない', () => {
    const lsmCfg = loadLsmConfig()
    const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
    // index 6 = 読まない's ない (real negation); index 11 = ません's ん is part of
    // か(助詞)も(助詞)しれる(動詞)ませ(助動詞)ん(助動詞) and must be excluded.
    expect(occurrenceList.negations).toEqual([6])
    expect(occurrenceList.negations).not.toContain(11)
  })
})
