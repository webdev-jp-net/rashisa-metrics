/**
 * Validates `measureTexts` against the stored per-scope and whole-manuscript stylometric profiles
 * for every tokenizer-independent field.
 *
 * This test owns a private replica of `build_chapter_diffs.clean` (term removal + PATTERNS
 * removal with the configured EXCEPTIONS) and of `chapter_source` (heading-marker /
 * horizontal-rule stripping + leading/trailing blank-line trim), rather than importing from
 * `src/lib/text` — that module is out of scope here and owned by another agent. Never prints
 * or embeds manuscript sentences: all assertions compare computed numbers/objects against the
 * stored profile, and any failure diff bun prints is limited to those numbers, not to the
 * underlying prose.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { scopeSourcePath, tryLoadReportConfig } from '../../../src/lib/config/report-config'
import { NullTokenizer } from '../../../src/lib/morph'
import { measureTexts } from '../../../src/lib/metrics'

const { hasSeriesConfig, config } = tryLoadReportConfig()
const scopeIdList = hasSeriesConfig ? config.scopeList.map(scope => scope.id) : []

// --- private replica of build_chapter_diffs.py's `clean` / `chapter_source` ---

const TERM_LIST = hasSeriesConfig ? config.anonymization.edited.termList : []
const EXCEPTION_LIST = new Set(hasSeriesConfig ? config.anonymization.edited.exceptionList : [])

// text_input.py PATTERNS, transcribed verbatim (JS string form: backslashes doubled so the
// resulting string content matches Python's raw-string regex source exactly).
const PATTERN_LIST: string[] = [
  "[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
  'https?://\\S+',
  '(?:\\+\\d[\\d ()-]{8,}\\d|0\\d{1,4}[-‐−ー－]\\d{1,4}[-‐−ー－]\\d{3,4})',
  '(?<!\\d)0\\d{9,10}(?!\\d)',
  '〒?\\d{3}[-‐−ー－]\\d{4}',
  '(?<!\\d)(?:\\d[ -]?){12,19}(?!\\d)',
  '[一-龥]{2,3}[都道府県][^\\s\\n。、]{1,60}',
  '/Users/[A-Za-z0-9_.-]+',
  '\\[[^\\]\\n]+\\]',
]

/** Replica of build_chapter_diffs.clean: term removal, then PATTERNS removal with EXCEPTIONS kept as-is. */
function clean(text: string): string {
  const sortedTermList = [...TERM_LIST].sort(
    (a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0)
  )
  let result = text
  for (const term of sortedTermList) result = result.split(term).join('')
  for (const patternSource of PATTERN_LIST) {
    const pattern = new RegExp(patternSource, 'g')
    result = result.replace(pattern, match => (EXCEPTION_LIST.has(match) ? match : ''))
  }
  return result
}

/** Replica of the document preprocessing (text only; line-number tracking is unused here). */
function chapterSource(scope: number): string {
  const raw = readFileSync(scopeSourcePath(config, scope), 'utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  const kept: string[] = []
  for (const line of raw.split('\n')) {
    if (/^\s*-{3,}\s*$/.test(line)) continue
    kept.push(line.replace(/^#{1,6} /, ''))
  }
  while (kept.length && !kept[0]!.trim()) kept.shift()
  while (kept.length && !kept[kept.length - 1]!.trim()) kept.pop()
  return kept.join('\n').trim()
}

// --- fixture loading ---

function loadJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function storedProfile(path: string): any {
  return loadJson(path).stylometricProfile
}

// --- comparisons ---

function expectTokenizerIndependentFieldsMatch(measured: any, stored: any) {
  expect(measured.corpusSize).toEqual(stored.meta.corpusSize)
  expect(measured.sentence.lengthDist).toEqual(stored.sentence.lengthDist)
  expect(measured.paragraph.lengthDist).toEqual(stored.paragraph.lengthDist)
  expect(measured.document.lengthDist).toEqual(stored.document.lengthDist)
  expect(measured.punctuation).toEqual(stored.punctuation)
  expect(measured.sentenceEnding).toEqual(stored.sentenceEnding)
  expect(measured.charNgramSignature.topFrequency).toEqual(stored.charNgramSignature.topFrequency)
}

describe.skipIf(!hasSeriesConfig)('measureTexts vs the stored per-scope profiles', () => {
  for (const scope of scopeIdList) {
    test(`scope ${scope}: tokenizer-independent fields match the stored profile`, () => {
      const original = chapterSource(scope)
      const cleaned = clean(original)
      const measured = measureTexts([cleaned], {
        documentType: 'article',
        tokenizer: NullTokenizer,
      })
      const stored = storedProfile(
        join(
          config.pathList.editedScopeProfile.replace('{scope}', String(scope)),
          'stylometric_profile.json'
        )
      )
      expectTokenizerIndependentFieldsMatch(measured, stored)
    })
  }
})

describe.skipIf(!hasSeriesConfig)('measureTexts vs the stored whole-manuscript profile', () => {
  test('per-scope documents (chars sum to the whole corpusSize) match', () => {
    const cleanedChapterList = scopeIdList.map(scope => clean(chapterSource(scope)))
    const measured = measureTexts(cleanedChapterList, {
      documentType: 'article',
      tokenizer: NullTokenizer,
    })
    const stored = storedProfile(join(config.pathList.editedProfile, 'stylometric_profile.json'))
    // Confirms the assembly hypothesis itself before trusting the field comparison below:
    // the whole-manuscript profile is measured over the per-scope cleaned chapters as separate
    // documents (corpusSize.documents === scopeIdList.length), not one document made by joining them.
    expect(stored.meta.corpusSize.documents).toBe(scopeIdList.length)
    expectTokenizerIndependentFieldsMatch(measured, stored)
  })
})
