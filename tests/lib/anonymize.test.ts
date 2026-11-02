import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { clean, sanitationInfo, visible } from '@/lib/text/anonymize'
import type { AnonymizationConfig } from '@/lib/text/anonymize'

// Synthetic names and phrases only: nothing here comes from a manuscript or a term list.
const cfg: AnonymizationConfig = {
  termList: ['アオイ', 'ソラさん'],
  exceptionList: ['流星道場に通う日々'],
  authorTerm: 'アオイ',
}

// Expected outputs below are cross-checked against a direct port of build_chapter_diffs.clean()/
// visible() run in Python 3 against the same synthetic strings (never against manuscript text).

describe('clean', () => {
  test('removes anonymization terms', () => {
    expect(clean('アオイはソラさんと話した', cfg)).toBe('はと話した')
  })

  test('removes PII-shaped patterns entirely, leaving surrounding whitespace untouched', () => {
    // A single token removed from between two spaces leaves both spaces (no collapsing).
    expect(clean('連絡先は test@example.com です', cfg)).toBe('連絡先は  です')
    expect(clean('サイトは https://example.com/page を見てください', cfg)).toBe(
      'サイトは  を見てください'
    )
    expect(clean('電話は 03-1234-5678 でした', cfg)).toBe('電話は  でした')
  })

  test('keeps a listed exception when the matched span equals it exactly', () => {
    // The prefecture-address pattern (kanji{2,3}+都道府県+non-punctuation run) matches
    // '流星道場に通う日々' itself (道 read as the 府県 marker); a punctuation boundary
    // right after it is what makes the match exactly equal the exception string.
    expect(clean('流星道場に通う日々。それから', cfg)).toBe('流星道場に通う日々。それから')
  })

  test('removes an unlisted bracketed span', () => {
    expect(clean('[メモ: 個人的な話] が続く', cfg)).toBe(' が続く')
  })

  test('longest term wins when one term is a substring of another', () => {
    const overlapping: AnonymizationConfig = {
      termList: ['オイ', 'アオイ'],
      exceptionList: [],
      authorTerm: 'アオイ',
    }
    expect(clean('アオイです', overlapping)).toBe('です')
  })
})

describe('visible', () => {
  test('masks PII-shaped patterns with ［個人情報］, except listed exceptions', () => {
    expect(visible('連絡先は test@example.com です', cfg)).toBe('連絡先は ［個人情報］ です')
    expect(visible('流星道場に通う日々。それから', cfg)).toBe('流星道場に通う日々。それから')
  })

  test('does not mask a bracketed span (the last pattern is excluded from visible masking)', () => {
    expect(visible('[メモ: 個人的な話] が続く', cfg)).toBe('[メモ: 個人的な話] が続く')
  })

  test('replaces the author term with ［著者名］ and other terms with ［人物名］', () => {
    expect(visible('アオイはソラさんと話した', cfg)).toBe('［著者名］は［人物名］と話した')
  })
})

describe('sanitationInfo', () => {
  test('is a deterministic hash of the sorted, de-duplicated term list', () => {
    const a = sanitationInfo(['b', 'a', 'a'])
    const b = sanitationInfo(['a', 'b'])
    expect(a.version).toBe('basic-pii-and-terms-v1')
    expect(a.termListHash).toBe(b.termListHash)
  })

  test('matches the byte layout of json.dumps(sorted(set(terms)), ensure_ascii=False)', () => {
    // json.dumps(["a", "b"], ensure_ascii=False) == '["a", "b"]' (comma-space separated);
    // sha256(b'["a", "b"]').hexdigest() computed independently for this fixed input.
    const { termListHash: termListHash } = sanitationInfo(['b', 'a'])
    const expected = createHash('sha256').update('["a", "b"]', 'utf8').digest('hex')
    expect(termListHash).toBe(expected)
  })
})
