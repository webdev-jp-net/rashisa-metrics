/**
 * extract prepare: which profiles it writes, what their meta says, and that --check never writes.
 * Everything runs against a throwaway repository built by fixture.ts with NullTokenizer, so the
 * measured numbers are the tokenizer-free subset — the shape and the bookkeeping are what matter.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { sha256File } from '../../../src/lib/data/json-io'
import {
  chapterProfilePath,
  editedProfilePath,
  loadStylometricProfile,
  modelProfilePath,
} from '../../../src/lib/data/profiles'
import { mismatchedCheckList, prepare } from '../../../src/lib/extract/prepare'
import { NullTokenizer } from '../../../src/lib/morph'
import {
  measureChapter,
  measureCorpus,
  type RevisionContext,
} from '../../../src/lib/revision/measure'
import { chapterSource } from '../../../src/lib/text/chapter-source'
import { createFixture, removeFixture, type Fixture } from './fixture'

let fixture: Fixture | null = null

/**
 * テストごとに新しい一時リポジトリを用意する。
 *
 * @returns 一時リポジトリと、解析器なしの実行文脈。
 */
function setup(): { fixture: Fixture; ctx: RevisionContext } {
  fixture = createFixture()
  return { fixture, ctx: { config: fixture.config, tokenizer: NullTokenizer } }
}

afterEach(() => {
  if (fixture !== null) removeFixture(fixture)
  fixture = null
})

describe('prepare', () => {
  test('writes one profile per media plus one per scope', () => {
    const { fixture: temp, ctx } = setup()
    const result = prepare(ctx, {})

    expect(result.checkList).toEqual([])
    expect(result.written).toEqual([
      modelProfilePath(temp.config),
      editedProfilePath(temp.config),
      chapterProfilePath(temp.config, 0),
      chapterProfilePath(temp.config, 1),
    ])
    for (const path of result.written) expect(existsSync(path)).toBe(true)
  })

  test('the model profile lists every .md in filename order and nothing else', () => {
    const { fixture: temp, ctx } = setup()
    prepare(ctx, {})
    const { meta } = loadStylometricProfile(modelProfilePath(temp.config)).stylometricProfile

    expect(meta.register).toBe('model')
    expect(meta.sourceDir).toBe('source/note')
    expect(meta.preprocessingRule).toBe('markdown-document-v1')
    expect(meta.textState).toBe('sanitized')
    expect(meta.schemaVersion).toBe(2)
    expect(meta.corpusSize.documents).toBe(2)
    expect(meta.sourceFileList).toEqual([
      {
        sourceRef: 'a-article',
        path: 'source/note/a-article.md',
        sha256: sha256File(join(temp.config.pathList.modelSource, 'a-article.md')),
      },
      {
        sourceRef: 'b-article',
        path: 'source/note/b-article.md',
        sha256: sha256File(join(temp.config.pathList.modelSource, 'b-article.md')),
      },
    ])
  })

  test('the edited profile measures every scope in id order', () => {
    const { fixture: temp, ctx } = setup()
    prepare(ctx, {})
    const { meta } = loadStylometricProfile(editedProfilePath(temp.config)).stylometricProfile

    expect(meta.register).toBe('edited')
    expect(meta.sourceDir).toBe('source/book')
    expect(meta.corpusSize.documents).toBe(2)
    expect(meta.sourceFileList.map(file => file.sourceRef)).toEqual(['scope-00', 'scope-01'])
    expect(meta.sourceFileList.map(file => file.path)).toEqual([
      'source/book/scope-00.md',
      'source/book/scope-01.md',
    ])
  })

  test('each scope profile is named after its own profile directory', () => {
    const { fixture: temp, ctx } = setup()
    prepare(ctx, {})
    for (const scope of [0, 1]) {
      const { meta } = loadStylometricProfile(
        chapterProfilePath(temp.config, scope)
      ).stylometricProfile
      expect(meta.register).toBe(`scope${scope}`)
      expect(meta.corpusSize.documents).toBe(1)
      expect(meta.sourceFileList.map(file => file.sourceRef)).toEqual([`scope-0${scope}`])
    }
  })

  test('a saved profile keeps meta first and the metrics after it', () => {
    const { fixture: temp, ctx } = setup()
    prepare(ctx, {})
    const saved = JSON.parse(readFileSync(modelProfilePath(temp.config), 'utf-8')) as {
      stylometricProfile: Record<string, unknown>
    }

    expect(Object.keys(saved.stylometricProfile)).toEqual([
      'meta',
      'sentence',
      'paragraph',
      'document',
      'punctuation',
      'functionWords',
      'lsmCategory',
      'politeness',
      'sentenceEnding',
      'charNgramSignature',
      'vocabulary',
      'uncomputed',
    ])
    expect(Object.keys(saved.stylometricProfile.meta as Record<string, unknown>)).toEqual([
      'register',
      'corpusSize',
      'textState',
      'measurement',
      'schemaVersion',
      'sourceDir',
      'sourceFileList',
      'preprocessingRule',
    ])
  })
})

describe('prepare --check', () => {
  test('writes nothing and reports the missing profiles', () => {
    const { fixture: temp, ctx } = setup()
    const result = prepare(ctx, { check: true })

    expect(result.written).toEqual([])
    expect(result.checkList).toHaveLength(4)
    expect(result.checkList.every(check => !check.exists)).toBe(true)
    expect(mismatchedCheckList(result.checkList)).toHaveLength(4)
    expect(existsSync(join(temp.root, 'data'))).toBe(false)
  })

  test('reports no difference right after a write', () => {
    const { ctx } = setup()
    prepare(ctx, {})
    const { checkList } = prepare(ctx, { check: true })

    expect(checkList.map(check => check.register)).toEqual(['model', 'edited', 'scope0', 'scope1'])
    expect(mismatchedCheckList(checkList)).toEqual([])
  })

  test('separates changed metrics from a changed meta', () => {
    const { fixture: temp, ctx } = setup()
    prepare(ctx, {})

    const profilePath = chapterProfilePath(temp.config, 0)
    const saved = JSON.parse(readFileSync(profilePath, 'utf-8')) as {
      stylometricProfile: { meta: Record<string, unknown>; punctuation: Record<string, unknown> }
    }
    saved.stylometricProfile.meta.register = 'legacy_name'
    saved.stylometricProfile.punctuation.kuten = 0
    writeFileSync(profilePath, JSON.stringify(saved), 'utf-8')

    const mismatched = mismatchedCheckList(prepare(ctx, { check: true }).checkList)
    expect(mismatched).toHaveLength(1)
    expect(mismatched[0].measured).toEqual(['punctuation'])
    expect(mismatched[0].meta).toEqual(['register'])
    expect(mismatched[0].path).toBe(
      'data/test-series/profiles/edited/scope0/stylometric_profile.json'
    )
  })

  test('a changed source file shows up as changed metrics and a changed hash', () => {
    const { fixture: temp, ctx } = setup()
    const written = prepare(ctx, {}).written
    writeFileSync(
      join(temp.config.pathList.editedSource, 'scope-01.md'),
      '# 第1章\n\nからだは、毎日の習慣でつくられます。\n',
      'utf-8'
    )
    // 不一致がある状態でも、--checkは保存済みプロファイルに一切触れない
    const before = written.map(path => readFileSync(path))

    const mismatched = mismatchedCheckList(prepare(ctx, { check: true }).checkList)
    expect(mismatched.map(check => check.register)).toEqual(['edited', 'scope1'])
    expect(mismatched[1].measured).toContain('corpusSize')
    expect(mismatched[1].meta).toEqual(['sourceFileList'])
    expect(written.map(path => readFileSync(path))).toEqual(before)
  })

  test('a field only the saved profile has counts as a difference', () => {
    const { fixture: temp, ctx } = setup()
    prepare(ctx, {})

    const profilePath = chapterProfilePath(temp.config, 0)
    const saved = JSON.parse(readFileSync(profilePath, 'utf-8')) as {
      stylometricProfile: Record<string, unknown>
    }
    saved.stylometricProfile.legacy_metric = { value: 1 }
    writeFileSync(profilePath, JSON.stringify(saved), 'utf-8')

    const mismatched = mismatchedCheckList(prepare(ctx, { check: true }).checkList)
    expect(mismatched).toHaveLength(1)
    expect(mismatched[0].measured).toEqual(['legacy_metric'])
    expect(mismatched[0].meta).toEqual([])
  })
})

describe('prepare guards', () => {
  test('stops and names the file when a document is empty after preprocessing', () => {
    const { fixture: temp, ctx } = setup()
    const path = join(temp.config.pathList.editedSource, 'scope-01.md')
    // 罫線行と空行だけのファイルは、前処理後の本文が空になる
    writeFileSync(path, '\n---\n\n', 'utf-8')

    expect(() => prepare(ctx, {})).toThrow(`原資料の本文が空です: ${path}`)
    expect(existsSync(join(temp.root, 'data'))).toBe(false)
  })

  test('stops when the model source directory has no .md at all', () => {
    const { fixture: temp, ctx } = setup()
    for (const name of ['a-article.md', 'b-article.md']) {
      rmSync(join(temp.config.pathList.modelSource, name))
    }

    expect(() => prepare(ctx, {})).toThrow('nonempty text records required')
    expect(existsSync(join(temp.root, 'data'))).toBe(false)
  })

  test('stops when two scopes point at the same source file', () => {
    const { fixture: temp, ctx } = setup()
    temp.config.scopeList = [
      { id: 0, file: 'scope-00.md' },
      { id: 1, file: 'scope-00.md' },
    ]

    expect(() => prepare(ctx, {})).toThrow('原資料のsourceRefが重複しています: scope-00')
    expect(existsSync(join(temp.root, 'data'))).toBe(false)
  })
})

describe('measureCorpus', () => {
  test('one document matches measureChapter exactly', () => {
    const { fixture: temp, ctx } = setup()
    const { text } = chapterSource(
      readFileSync(join(temp.config.pathList.editedSource, 'scope-00.md'), 'utf-8')
    )

    const corpus = measureCorpus([text], temp.config.anonymization.edited, NullTokenizer)
    expect(corpus).toEqual(measureChapter(text, ctx).profile)
  })

  test('measures the anonymized text and records which anonymization produced it', () => {
    const { fixture: temp } = setup()
    const { edited } = temp.config.anonymization

    expect(measureCorpus(['名前太郎です。こんにちは。'], edited, NullTokenizer)).toEqual(
      measureCorpus(['です。こんにちは。'], edited, NullTokenizer)
    )
    const measurement = measureCorpus(['です。'], edited, NullTokenizer).measurement
    const sanitization = (measurement as unknown as Record<string, unknown>).sanitization as Record<
      string,
      unknown
    >
    expect(sanitization.version).toBe('basic-pii-and-terms-v1')
    expect(sanitization.termListHash).toMatch(/^[0-9a-f]{64}$/)
    expect(sanitization.nonPiiExceptionList).toEqual([])
  })
})
