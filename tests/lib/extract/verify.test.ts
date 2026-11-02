/**
 * extract verify: the format checks over the agent-written exemplar bank, writing sheet and
 * synthesis. Runs against a throwaway repository built by fixture.ts, never the real data/ tree.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { prepare } from '../../../src/lib/extract/prepare'
import { verify } from '../../../src/lib/extract/verify'
import type { VerifyFailure } from '../../../src/lib/extract/types'
import { NullTokenizer } from '../../../src/lib/morph'
import { createFixture, removeFixture, type Fixture } from './fixture'

/** お手本記事`a-article`の本文の一部。 */
const MODEL_TEXT = '眠りの質は、日中の過ごし方で決まります。'

/** スコープ`scope-00`の本文の一部。匿名化対象の用語を含まない。 */
const EDITED_TEXT = 'この本では、からだの整え方について書きます。'

let fixture: Fixture | null = null

/**
 * 実例1件を作る。`text`を差し替えたときは`chars`も差し替える。
 *
 * @param base 既定値。
 * @param overrides 上書きするフィールド。
 * @returns 実例1件。
 */
function exemplar(
  base: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return { ...base, ...overrides }
}

/**
 * 実例集を書き出す。
 *
 * @param dir プロファイルディレクトリ。
 * @param recordList 1行1件の実例。
 */
function writeBank(dir: string, recordList: Record<string, unknown>[]): void {
  writeFileSync(
    join(dir, 'exemplar_bank.jsonl'),
    recordList.map(record => `${JSON.stringify(record)}\n`).join(''),
    'utf-8'
  )
}

/**
 * プロファイル一式と、検査を通るagentの成果物を書いた一時リポジトリを用意する。
 *
 * @returns 一時リポジトリと、媒体ごとの既定の実例。
 */
function setup(): {
  fixture: Fixture
  modelDir: string
  editedDir: string
  modelExemplar: Record<string, unknown>
  editedExemplar: Record<string, unknown>
} {
  fixture = createFixture()
  const { config } = fixture
  prepare({ config, tokenizer: NullTokenizer }, {})

  const modelExemplar = {
    id: 'ex_001',
    text: MODEL_TEXT,
    chars: [...MODEL_TEXT].length,
    tagList: ['opening'],
    structureNote: '断定の一文で受ける。',
    sourceRef: 'a-article',
    quality: 'gold',
  }
  const editedExemplar = {
    id: 'book_ex_001',
    text: EDITED_TEXT,
    chars: [...EDITED_TEXT].length,
    tagList: ['opening'],
    structureNote: '本の狙いを一文で置く。',
    sourceRef: 'scope-00',
    quality: 'silver',
  }
  const modelDir = config.pathList.modelProfile
  const editedDir = config.pathList.editedProfile
  writeBank(modelDir, [modelExemplar])
  writeBank(editedDir, [editedExemplar])
  writeFileSync(
    join(modelDir, 'author_writing_sheet.md'),
    '書き出しは a-article を見る。\n',
    'utf-8'
  )
  writeFileSync(join(modelDir, 'expert_synthesis.md'), '## 観察\n\n根拠は ex_001。\n', 'utf-8')
  writeFileSync(
    join(editedDir, 'author_writing_sheet.md'),
    '書き出しは scope-00 を見る。\n',
    'utf-8'
  )
  writeFileSync(
    join(editedDir, 'expert_synthesis.md'),
    '## 観察\n\n根拠は book_ex_001。\n',
    'utf-8'
  )

  return { fixture, modelDir, editedDir, modelExemplar, editedExemplar }
}

afterEach(() => {
  if (fixture !== null) removeFixture(fixture)
  fixture = null
})

/**
 * 不合格の理由だけを取り出す。
 *
 * @param failureList `verify`の結果。
 * @returns 理由の配列。
 */
function reasonList(failureList: VerifyFailure[]): string[] {
  return failureList.map(failure => failure.reason)
}

describe('verify', () => {
  test('passes when the profiles and the agent files are in order', () => {
    const { fixture: temp } = setup()
    expect(verify(temp.config)).toEqual([])
  })

  test('fails when a source file changed after the profile was measured', () => {
    const { fixture: temp } = setup()
    writeFileSync(
      join(temp.config.pathList.modelSource, 'a-article.md'),
      'こんにちは。書き直しました。\n',
      'utf-8'
    )

    const failureList = verify(temp.config)
    expect(failureList[0].register).toBe('model')
    expect(failureList[0].target).toBe('a-article')
    expect(failureList[0].reason).toContain('原資料が計測時から変わっています')
  })

  test('fails when a measured source file no longer exists', () => {
    const { fixture: temp } = setup()
    rmSync(join(temp.config.pathList.modelSource, 'b-article.md'))

    const failureList = verify(temp.config)
    expect(failureList).toHaveLength(1)
    expect(failureList[0].register).toBe('model')
    expect(failureList[0].target).toBe('b-article')
    expect(failureList[0].reason).toBe('原資料がありません: source/note/b-article.md')
  })

  test('fails when the profile is missing', () => {
    const { fixture: temp, modelDir } = setup()
    rmSync(join(modelDir, 'stylometric_profile.json'))

    const failureList = verify(temp.config)
    expect(failureList).toHaveLength(1)
    expect(failureList[0].reason).toContain('文体プロファイルがありません')
  })

  test('fails when the exemplar bank is missing or empty', () => {
    const { fixture: temp, modelDir } = setup()
    // 統合文書はex_001を引いているため、実例が消えるとその出典も実在しなくなる
    writeFileSync(join(modelDir, 'exemplar_bank.jsonl'), '\n', 'utf-8')
    expect(reasonList(verify(temp.config))).toEqual([
      '実例集が空です',
      '出典（sourceRefか実例id）が1件も書かれていません',
    ])

    rmSync(join(modelDir, 'exemplar_bank.jsonl'))
    expect(reasonList(verify(temp.config))).toEqual([
      '実例集がありません',
      '出典（sourceRefか実例id）が1件も書かれていません',
    ])
  })

  test('fails when text is not part of its document', () => {
    const { fixture: temp, modelDir, modelExemplar } = setup()
    const text = '眠りの質は、朝の光で決まります。'
    writeBank(modelDir, [exemplar(modelExemplar, { text, chars: [...text].length })])

    const failureList = verify(temp.config)
    expect(failureList).toHaveLength(1)
    expect(failureList[0].target).toBe('ex_001')
    expect(failureList[0].reason).toBe('textがa-articleの本文の一部と一致しません')
  })

  test('fails when text is empty', () => {
    const { fixture: temp, modelDir, modelExemplar } = setup()
    // 空文字はどの本文にも含まれてしまうため、本文との照合では落とせない
    writeBank(modelDir, [exemplar(modelExemplar, { text: '', chars: 0 })])

    expect(reasonList(verify(temp.config))).toEqual(['textが空です'])
  })

  test('fails when chars is not the code point count of text', () => {
    const { fixture: temp, modelDir, modelExemplar } = setup()
    writeBank(modelDir, [exemplar(modelExemplar, { chars: 3 })])

    expect(reasonList(verify(temp.config))).toEqual([
      `charsがtextの文字数（${[...MODEL_TEXT].length}）と一致しません`,
    ])
  })

  test('fails when sourceRef is not one of the measured documents', () => {
    const { fixture: temp, modelDir, modelExemplar } = setup()
    writeBank(modelDir, [exemplar(modelExemplar, { sourceRef: 'note/a-article' })])

    expect(reasonList(verify(temp.config))).toEqual([
      'sourceRefがプロファイルの原資料にありません: "note/a-article"',
    ])
  })

  test('fails when quality, tags or structureNote are not as specified', () => {
    const { fixture: temp, modelDir, modelExemplar } = setup()
    writeBank(modelDir, [
      exemplar(modelExemplar, { quality: 'bronze', tagList: 'opening', structureNote: ' ' }),
    ])

    expect(reasonList(verify(temp.config))).toEqual([
      'qualityはgoldかsilverにしてください: "bronze"',
      'tagListが配列ではありません',
      'structureNoteが空です',
    ])
  })

  test('fails when an id repeats', () => {
    const { fixture: temp, modelDir, modelExemplar } = setup()
    writeBank(modelDir, [modelExemplar, exemplar(modelExemplar, { sourceRef: 'b-article' })])

    const failureList = verify(temp.config)
    expect(reasonList(failureList)).toContain('idが重複しています')
  })

  test('fails when an exemplar keeps a term the media anonymizes', () => {
    const { fixture: temp, editedDir, editedExemplar } = setup()
    const text = 'こんにちは。名前太郎です。'
    writeBank(editedDir, [exemplar(editedExemplar, { text, chars: [...text].length })])

    const failureList = verify(temp.config)
    expect(failureList).toHaveLength(1)
    expect(failureList[0].register).toBe('edited')
    expect(failureList[0].reason).toBe('textに匿名化対象の用語が残っています: 名前太郎')
  })

  test('fails when a line is not JSON', () => {
    const { fixture: temp, modelDir } = setup()
    writeFileSync(join(modelDir, 'exemplar_bank.jsonl'), '{"id": "ex_001"\n', 'utf-8')

    const failureList = verify(temp.config)
    expect(failureList[0].target).toBe('1行目')
    expect(failureList[0].reason).toBe('JSONとして読めません')
  })

  test('fails when a sheet cites no existing sourceRef or exemplar id', () => {
    const { fixture: temp, editedDir } = setup()
    // scope-0はscope-00の一部でしかないため、出典を引いたことにはならない
    writeFileSync(
      join(editedDir, 'author_writing_sheet.md'),
      '観点は scope-0 に書いた。\n',
      'utf-8'
    )

    const failureList = verify(temp.config)
    expect(failureList).toHaveLength(1)
    expect(failureList[0].file).toBe('data/test-series/profiles/edited/author_writing_sheet.md')
    expect(failureList[0].reason).toBe('出典（sourceRefか実例id）が1件も書かれていません')
  })

  test('fails when a sheet cites an exemplar id that is only a prefix of a real one', () => {
    const { fixture: temp, modelDir, modelExemplar } = setup()
    writeBank(modelDir, [exemplar(modelExemplar, { id: 'ex_01' })])
    // ex_01はex_010の一部でしかないため、出典を引いたことにはならない
    writeFileSync(join(modelDir, 'author_writing_sheet.md'), '根拠は ex_010 に書いた。\n', 'utf-8')
    writeFileSync(join(modelDir, 'expert_synthesis.md'), '## 観察\n\n根拠は ex_01。\n', 'utf-8')

    const failureList = verify(temp.config)
    expect(failureList).toHaveLength(1)
    expect(failureList[0].file).toBe('data/test-series/profiles/model/author_writing_sheet.md')
    expect(failureList[0].reason).toBe('出典（sourceRefか実例id）が1件も書かれていません')
  })

  test('fails when a sheet is missing or empty', () => {
    const { fixture: temp, modelDir } = setup()
    writeFileSync(join(modelDir, 'expert_synthesis.md'), '\n\n', 'utf-8')
    rmSync(join(modelDir, 'author_writing_sheet.md'))

    expect(reasonList(verify(temp.config))).toEqual(['ファイルがありません', '中身が空です'])
  })

  test('accepts a sheet that cites a sourceRef in a sentence', () => {
    const { fixture: temp, modelDir } = setup()
    const sheet = readFileSync(join(modelDir, 'author_writing_sheet.md'), 'utf-8')
    writeFileSync(
      join(modelDir, 'author_writing_sheet.md'),
      `${sheet}（b-article）も同じ。\n`,
      'utf-8'
    )

    expect(verify(temp.config)).toEqual([])
  })
})
