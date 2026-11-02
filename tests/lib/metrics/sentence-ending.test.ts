import { describe, expect, test } from 'bun:test'
import { classifySentenceEnding } from '../../../src/lib/metrics'

describe('classifySentenceEnding', () => {
  test('desuMasu: です・ます・でした・ました, with or without trailing punctuation', () => {
    expect(classifySentenceEnding('今日は晴れです')).toBe('desuMasu')
    expect(classifySentenceEnding('明日も晴れます。')).toBe('desuMasu')
    expect(classifySentenceEnding('昨日は雨でした')).toBe('desuMasu')
    expect(classifySentenceEnding('先週は忙しかったです！')).toBe('desuMasu')
  })

  test('daDearu: だ・である・だった', () => {
    expect(classifySentenceEnding('これは机だ')).toBe('daDearu')
    expect(classifySentenceEnding('それは事実である。')).toBe('daDearu')
    expect(classifySentenceEnding('あれは誤りだった')).toBe('daDearu')
  })

  test('finalParticle: ね・よ・かな・な・わ・の', () => {
    expect(classifySentenceEnding('もう行くね')).toBe('finalParticle')
    expect(classifySentenceEnding('絶対やるよ。')).toBe('finalParticle')
    expect(classifySentenceEnding('うまくいくかな')).toBe('finalParticle')
    expect(classifySentenceEnding('気をつけな')).toBe('finalParticle')
    expect(classifySentenceEnding('本当に嬉しいわ')).toBe('finalParticle')
    expect(classifySentenceEnding('もう帰るの')).toBe('finalParticle')
  })

  test('symbolEnd: trailing ！!？?… with no matching wording pattern before it', () => {
    expect(classifySentenceEnding('えっ…')).toBe('symbolEnd')
    expect(classifySentenceEnding('本当に？')).toBe('symbolEnd')
    expect(classifySentenceEnding('うそ!!')).toBe('symbolEnd')
  })

  test('taigenDomeOrOther: ends in a kanji/hiragana/katakana/prolonged-mark character with no other match', () => {
    expect(classifySentenceEnding('静かな朝')).toBe('taigenDomeOrOther')
    expect(classifySentenceEnding('駅前のカフェ')).toBe('taigenDomeOrOther')
    expect(classifySentenceEnding('遠くの山')).toBe('taigenDomeOrOther')
  })

  test('noEnding: neither a wording pattern, a trailing symbol, nor a trailing Japanese character', () => {
    expect(classifySentenceEnding('メモ123')).toBe('noEnding')
    expect(classifySentenceEnding('OK')).toBe('noEnding')
  })

  test('pattern precedence: daDearu is checked before taigenDomeOrOther', () => {
    // "である" ends in "る", a kana character that alone would satisfy the
    // taigenDomeOrOther fallback — but the daDearu pattern is checked first and wins.
    expect(classifySentenceEnding('それはそうである')).toBe('daDearu')
  })
})
