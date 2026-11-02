/**
 * Covers proposal_text.py's reader-facing copy rules: the display fallback (readerCopy) and the
 * checks (copyErrors / validateCopy). The 100/80 character counts are writing rules for the agent,
 * not checks, so no length assertion appears here.
 */
import { describe, expect, test } from 'bun:test'
import { copyErrorList, readerCopy, validateCopy } from '../../../src/lib/revision/reader-copy'

describe('copyErrors', () => {
  test('accepts copy that stands on its own', () => {
    expect(
      copyErrorList({
        displayReason: '重複する言い回しをまとめる。',
        tradeoff: '反復の強調が薄れる。',
      })
    ).toEqual([])
  })

  test('requires text in both fields', () => {
    expect(copyErrorList({ displayReason: '  ', tradeoff: undefined })).toEqual([
      'displayReason: 文が必要です',
      'tradeoff: 文が必要です',
    ])
  })

  test('rejects internal identifiers, internal document names and file names', () => {
    // Python's \\b is Unicode-aware, so an identifier only counts when it is not run together with
    // the following Japanese: these are the forms the legacy checker actually rejects.
    const caseList = [
      'ex_001',
      'ex_0001',
      'ex_001、参考',
      '候補 ex_001 を参照する。',
      'c001 と合わせて',
      'quantifiers',
      'stylometricProfile を見る',
      'p001の扱い。metrics.py。',
      'レキシコンに載る語を減らす。',
      '数量語リストの語を外す。',
    ]
    for (const value of caseList) {
      expect(copyErrorList({ displayReason: value, tradeoff: 'ok。' })).toEqual([
        'displayReason: 内部ID・内部資料名を説明から外してください',
      ])
    }
  })

  test('treats an identifier run together with Japanese as one word, as Python does', () => {
    // 'ex_001は' has no word boundary after the digits under Python's Unicode \\b, so the legacy
    // checker lets it through. Reproduced rather than tightened.
    for (const value of [
      'ex_001は良い。',
      'c001と合わせて採用する。',
      'metrics.pyの判定による。',
      'data.jsonlを読む。',
      '（ex_001参照）',
    ]) {
      expect(copyErrorList({ displayReason: value, tradeoff: 'ok。' })).toEqual([])
    }
  })

  test('rejects copy that defers to another entry', () => {
    expect(copyErrorList({ displayReason: '同上。', tradeoff: '同じ。' })).toEqual([
      'displayReason: この変更だけで分かる説明にしてください',
      'tradeoff: この変更だけで分かる説明にしてください',
    ])
  })
})

describe('validateCopy', () => {
  test('passes clean copy', () => {
    expect(() =>
      validateCopy([{ id: 'c001', displayReason: '語尾を整える。', tradeoff: '語調が変わる。' }])
    ).not.toThrow()
  })

  test('reports every offending field at once, with the context and candidate id', () => {
    let message = ''
    try {
      validateCopy(
        [
          { id: 'c001', displayReason: '同上。', tradeoff: '' },
          { id: 'c002', displayReason: 'ex_001', tradeoff: 'ok。' },
        ],
        'candidates1.json'
      )
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('candidates1.json c001: displayReason:')
    expect(message).toContain('candidates1.json c001: tradeoff: 文が必要です')
    expect(message).toContain('candidates1.json c002: displayReason: 内部ID')
    expect(message).toContain('該当する説明・副作用だけを修正して再検査してください。')
  })
})

describe('readerCopy', () => {
  test('keeps the first sentence', () => {
    const result = readerCopy({
      displayReason: '語尾を整える。さらに説明が続く。',
      tradeoff: '語調が変わる。補足。',
    })
    expect(result.displayReason).toBe('語尾を整える。')
    expect(result.tradeoff).toBe('語調が変わる。')
  })

  test('strips a parenthesised internal note', () => {
    expect(
      readerCopy({ displayReason: '語尾を整える（ex_001参照）。', tradeoff: 'x。' }).displayReason
    ).toBe('語尾を整える。')
  })

  test('rewrites the stored paragraph-statistics phrasing', () => {
    expect(
      readerCopy({ displayReason: 'p001は3文・約120字の段落。続き。', tradeoff: 'x。' })
        .displayReason
    ).toBe('段落を意味の切れ目で分ける。')
  })

  test('rewrites cross-candidate bookkeeping', () => {
    expect(
      readerCopy({ displayReason: 'c001と合わせて採用すると流れが整う。', tradeoff: 'x。' })
        .displayReason
    ).toBe('両方を採用すると流れが整う。')
    expect(
      readerCopy({ displayReason: 'c001と同じ言い換えにする。', tradeoff: 'x。' }).displayReason
    ).toBe('同じ文内の語を統一するにする。')
  })

  test('replaces copy that only defers to another entry', () => {
    expect(readerCopy({ displayReason: '同上。', tradeoff: '同上' }).displayReason).toBe(
      '語調がやや変わる。'
    )
  })

  test('falls back when an internal name survives stripping', () => {
    expect(
      readerCopy({ displayReason: 'p001の扱い。metrics.py。', tradeoff: 'x。' }).displayReason
    ).toBe('変更内容を簡潔に整理する。')
  })

  test('drops a bare internal identifier and keeps the rest of the sentence', () => {
    expect(
      readerCopy({ displayReason: '候補 ex_001 を参照する。', tradeoff: 'x。' }).displayReason
    ).toBe('候補 を参照する。')
    expect(
      readerCopy({ displayReason: 'quantifiersを減らす。', tradeoff: 'x。' }).displayReason
    ).toBe('を減らす。')
  })

  test('leaves every other field untouched', () => {
    const edit = { id: 'c001', before: 'a', after: 'b', displayReason: 'x。', tradeoff: 'y。' }
    expect(readerCopy(edit)).toEqual(edit)
  })
})
