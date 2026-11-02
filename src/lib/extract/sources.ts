import { readFileSync, readdirSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { scopeSourcePath, type ReportConfig } from '../config/report-config'
import { sha256File } from '../data/json-io'
import type { SourceFile } from '../data/types'
import { ensure } from '../revision/io'
import { chapterSource } from '../text/chapter-source'
import type { SourceDocument } from './types'

/**
 * 原資料ファイル1つを読んで前処理する。前処理後の本文が空のときは、`measureTexts`がどのファイルとも
 * 結びつかないエラーで止まる前に、ファイル名を添えてここで止める。
 *
 * @param path 原資料ファイルの絶対パス。
 * @returns 前処理した文書。
 * @throws ファイルが読めない、または前処理後の本文が空なら止める。
 */
function readDocument(path: string): SourceDocument {
  const { text } = chapterSource(readFileSync(path, 'utf-8'))
  ensure(text.trim() !== '', `原資料の本文が空です: ${path}`)
  return { sourceRef: basename(path, '.md'), path, text }
}

/**
 * お手本媒体の全文書。原資料ディレクトリ直下の`.md`をファイル名昇順に読む（`.jsonl`等は対象外）。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 計測順の文書。
 * @throws 原資料ディレクトリが無い、または本文が空の文書があれば止める。
 */
export function modelDocumentList(config: ReportConfig): SourceDocument[] {
  return readdirSync(config.pathList.modelSource)
    .filter(name => name.endsWith('.md'))
    .sort()
    .map(name => readDocument(join(config.pathList.modelSource, name)))
}

/**
 * 編集対象媒体の1スコープ分の文書。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 前処理した文書。
 * @throws 設定に無いスコープid、ファイルが読めない、または本文が空なら止める。
 */
export function scopeDocument(config: ReportConfig, scope: number): SourceDocument {
  return readDocument(scopeSourcePath(config, scope))
}

/**
 * 編集対象媒体の全文書。スコープid昇順（設定ファイル上の並びには依存しない）。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 計測順の文書。
 * @throws ファイルが読めない、または本文が空の文書があれば止める。
 */
export function editedDocumentList(config: ReportConfig): SourceDocument[] {
  return sortedScopeIdList(config).map(scope => scopeDocument(config, scope))
}

/**
 * スコープidを昇順に。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns スコープidの配列。
 */
export function sortedScopeIdList(config: ReportConfig): number[] {
  return [...config.scopeList].sort((a, b) => a.id - b.id).map(scope => scope.id)
}

/**
 * 文書一覧をプロファイルの`meta.sourceFileList`にする。順序は計測順のまま。`sourceRef`はファイル名由来
 * なので、重複はお手本・編集対象のどちらでも同じ文書を二重に数えていることを意味する（編集対象では
 * `scopeList[].file`の重複）。実例の`sourceRef`が一意に文書を指せなくなるため、ここで止める。
 *
 * @param root リポジトリルート。
 * @param documentList 計測に使った文書。
 * @returns `sourceRef`・相対パス・sha256の配列。
 * @throws `sourceRef`が重複していれば止める。
 */
export function sourceFileListOf(root: string, documentList: SourceDocument[]): SourceFile[] {
  const seen = new Set<string>()
  return documentList.map(document => {
    ensure(
      !seen.has(document.sourceRef),
      `原資料のsourceRefが重複しています: ${document.sourceRef}（${relative(root, document.path)}）`
    )
    seen.add(document.sourceRef)
    return {
      sourceRef: document.sourceRef,
      path: relative(root, document.path),
      sha256: sha256File(document.path),
    }
  })
}
