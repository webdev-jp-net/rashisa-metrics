/**
 * Builds a throwaway repository (sources + ReportConfig) under the OS temp directory so the
 * extract tests never read or write the real source/ and data/ trees. All text is synthetic.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ReportConfig } from '../../../src/lib/config/report-config'

/** お手本の記事（ファイル名→本文）。`sort()`で`a-article`→`b-article`の順になる。 */
export const MODEL_SOURCE_LIST: Record<string, string> = {
  'b-article.md':
    'こんにちは。トレーナーです。\n\n' +
    '夜中に目が覚めてしまう。そんな悩みをお持ちではありませんか？\n\n' +
    'まずは朝の光を浴びることから始めてみませんか？\n',
  'a-article.md':
    'こんにちは。トレーナーです。\n\n' +
    '眠りの質は、日中の過ごし方で決まります。\n\n' +
    '答えはとてもシンプルです。\n',
}

/** 編集対象のスコープ（ファイル名→本文）。見出し記号と区切り線を含め、前処理の対象にする。 */
export const EDITED_SOURCE_LIST: Record<string, string> = {
  'scope-00.md':
    '# はじめに\n\nこんにちは。名前太郎です。\n\n---\n\nこの本では、からだの整え方について書きます。\n',
  'scope-01.md':
    '# 第1章\n\nからだは、毎日の習慣でつくられます。\n\n大切なのは、続けられる形にすることです。\n',
}

/** 一時リポジトリ。`root`配下だけを読み書きする。 */
export interface Fixture {
  root: string
  config: ReportConfig
}

/**
 * お手本2記事・編集対象2スコープの原資料を一時ディレクトリに書き、それを指す設定を組み立てる。
 *
 * @returns 一時リポジトリのルートと設定。
 */
export function createFixture(): Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rashisa-extract-')))
  const modelSource = join(root, 'source/note')
  const editedSource = join(root, 'source/book')
  mkdirSync(modelSource, { recursive: true })
  mkdirSync(editedSource, { recursive: true })
  for (const [name, text] of Object.entries(MODEL_SOURCE_LIST)) {
    writeFileSync(join(modelSource, name), text, 'utf-8')
  }
  // 計測対象は`.md`だけ。同じディレクトリにある他の形式は無視される
  writeFileSync(join(modelSource, 'train.jsonl'), '{"id": "ignored"}\n', 'utf-8')
  for (const [name, text] of Object.entries(EDITED_SOURCE_LIST)) {
    writeFileSync(join(editedSource, name), text, 'utf-8')
  }

  const repoRoot = process.cwd()
  const config: ReportConfig = {
    root,
    seriesKey: 'test-series',
    scopeList: [
      { id: 1, file: 'scope-01.md' },
      { id: 0, file: 'scope-00.md' },
    ],
    pathList: {
      editedSource,
      modelSource,
      modelProfile: join(root, 'data/test-series/profiles/model'),
      editedProfile: join(root, 'data/test-series/profiles/edited'),
      editedScopeProfile: join(root, 'data/test-series/profiles/edited/scope{scope}'),
      report: join(root, 'data/test-series/report'),
      propose: join(root, 'data/test-series/propose'),
      lsmCategories: resolve(repoRoot, 'config/lsm_categories.yaml'),
      keigoLexicon: resolve(repoRoot, 'config/keigo_lexicon.yaml'),
    },
    anonymization: {
      model: { termList: [], exceptionList: [], authorTerm: '' },
      edited: { termList: ['名前太郎'], exceptionList: [], authorTerm: '名前太郎' },
    },
  }
  return { root, config }
}

/**
 * 一時リポジトリを消す。
 *
 * @param fixture `createFixture`の結果。
 */
export function removeFixture(fixture: Fixture): void {
  rmSync(fixture.root, { recursive: true, force: true })
}
