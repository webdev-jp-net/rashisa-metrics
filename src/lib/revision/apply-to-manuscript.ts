import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { scopeFilePath, scopeSourcePath, type ReportConfig } from '../config/report-config'
import { sha256String } from '../data/json-io'
import { loadDiffData } from '../data/report-data'
import { chapterSource } from '../text/chapter-source'
import { chapterText } from './measure'
import { ensure } from './io'
import type { PublishedDiffData, RevisionCandidate } from './types'

/**
 * `value`以下で最大の要素のindex（二分探索）。文字位置がどの行に属するかを引くのに使う。
 *
 * @param startList 昇順の行開始位置。
 * @param value 探す位置。
 * @returns index。`value`が先頭より前なら-1。
 */
function lastAtOrBefore(startList: number[], value: number): number {
  let low = 0
  let high = startList.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (value < startList[mid]!) high = mid
    else low = mid + 1
  }
  return low - 1
}

/**
 * 1行の本文に、その行の変更案を適用する。アルゴリズムは`applyEdits`と同一だが、エラー文言が異なる別関数として保つ（テストがこの文言に依存する）。
 *
 * @param body 1行の本文（見出し記号を除いたもの）。
 * @param editList その行の変更案。位置は行内オフセット。
 * @returns 適用後の本文。
 * @throws 範囲が不正・重なる・`before`が一致しない変更案があれば止める。
 */
export function spliceString(body: string, editList: RevisionCandidate[]): string {
  const ordered = [...editList].sort(
    (a, b) => a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  let last = 0
  for (const edit of ordered) {
    ensure(
      0 <= edit.start && edit.start < edit.end && edit.end <= body.length,
      `bad range: ${edit.id}`
    )
    ensure(edit.start >= last, `overlap: ${edit.id}`)
    ensure(body.slice(edit.start, edit.end) === edit.before, `fragment mismatch: ${edit.id}`)
    last = edit.end
  }
  let result = body
  for (const edit of [...ordered].reverse()) {
    result = result.slice(0, edit.start) + edit.after + result.slice(edit.end)
  }
  return result
}

/**
 * 1スコープの公開済み変更案を、そのスコープの原資料ファイルの行に写して改稿版のファイル内容を組み立てる。
 * 変更案は位置を「スコープ本文の何文字目か」（`start`/`end`）でしか持たず、スコープ本文はファイルから
 * 見出し記号・`---`を除いて前後を詰めた前処理結果なので、ファイルの行番号と行内の位置に写し直してから
 * 該当行だけを書き換える。見出し記号・`---`区切り・未変更行はバイト単位で同一のまま保つ。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param data 1スコープの公開済みデータ。
 * @returns 改稿版のファイル内容。
 * @throws 行境界をまたぐ変更案、見出し記号を除いた行が本文と一致しない場合は止める。
 */
export function buildScopeFile(config: ReportConfig, data: PublishedDiffData): string {
  const rawLineList = readFileSync(scopeSourcePath(config, data.section), 'utf-8').split('\n')
  const { text: original, lineList: sourceLineList } = chapterText(config, data.section)
  const originalLineList = original.split('\n')
  const startList: number[] = []
  let position = 0
  for (const line of originalLineList) {
    startList.push(position)
    position += line.length + 1
  }

  const lineEditList = new Map<number, RevisionCandidate[]>()
  for (const edit of data.editList as unknown as RevisionCandidate[]) {
    const index = lastAtOrBefore(startList, edit.start)
    const lineStart = startList[index]!
    const lineEnd = lineStart + originalLineList[index]!.length
    ensure(
      lineStart <= edit.start && edit.end <= lineEnd,
      `scope ${data.section} edit ${edit.id} crosses a manuscript line boundary`
    )
    const local = { ...edit, start: edit.start - lineStart, end: edit.end - lineStart }
    const bucket = lineEditList.get(index)
    if (bucket === undefined) lineEditList.set(index, [local])
    else bucket.push(local)
  }

  const modificationList = new Map<number, string[]>()
  for (const [index, editListOnLine] of lineEditList) {
    const lineNumber = sourceLineList[index]!
    const rawLine = rawLineList[lineNumber - 1]!
    const prefix = /^(#{1,6} )/.exec(rawLine)?.[1] ?? ''
    const body = rawLine.slice(prefix.length)
    ensure(
      body === originalLineList[index],
      `scope ${data.section} line ${lineNumber} stripped body mismatch`
    )
    const newLineList = spliceString(body, editListOnLine).split('\n')
    newLineList[0] = prefix + newLineList[0]
    modificationList.set(lineNumber, newLineList)
  }

  const output: string[] = []
  rawLineList.forEach((rawLine, index) => {
    output.push(...(modificationList.get(index + 1) ?? [rawLine]))
  })
  return output.join('\n')
}

/**
 * 組み立てた改稿版のファイルを前処理し直し、公開済みの`revisedTextSha256`と突き合わせる。
 *
 * @param text 組み立てた改稿版のファイル内容。
 * @param data そのスコープの公開済みデータ。
 * @throws 不一致なら止める。
 */
export function verifyScopeFile(text: string, data: PublishedDiffData): void {
  ensure(
    sha256String(chapterSource(text).text) === data.revisedTextSha256,
    `scope ${data.section}: reconstructed text does not match its revisedTextSha256`
  )
}

/** 書き込んだパスと反映したスコープ数。 */
export interface ApplyToManuscriptResult {
  written: string[]
  scopes: number
}

/**
 * シンボリックリンクを解決した絶対パス。まだ存在しないパスは、存在する最も近い親を解決してから
 * 残りの部分を繋ぐ（出力先ディレクトリは初回には存在しない）。
 *
 * @param path 対象のパス。
 * @returns リンクを解決した絶対パス。
 */
function realPath(path: string): string {
  let current = resolve(path)
  const rest: string[] = []
  while (!existsSync(current)) {
    const parent = dirname(current)
    if (parent === current) return resolve(current, ...rest)
    rest.unshift(basename(current))
    current = parent
  }
  return resolve(realpathSync(current), ...rest)
}

/**
 * 書き戻しの入口。公開済みの全スコープから改稿版のファイルを組み立て、全スコープが検証に通ってからだけ
 * `outDir`へ原資料と同じファイル名で書く。出力先の比較はシンボリックリンクを解決した実体パスで行い、
 * 出力先の既存ファイルがリンクなら（リンク先＝原資料を書いてしまうため）1件も書かずに止める。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param outDir 書き込み先ディレクトリ。原資料ディレクトリとは別のパス。
 * @returns 書き込んだパスとスコープ数。
 * @throws 出力先の実体が原資料ディレクトリと同じ、`scopeList[].file`が出力先の外を指す、出力先の既存ファイルが
 * シンボリックリンク、1スコープでも検証に通らない、のいずれかなら止める（何も書かない）。
 */
export function applyToManuscript(config: ReportConfig, outDir: string): ApplyToManuscriptResult {
  const destination = resolve(outDir)
  ensure(
    realPath(destination) !== realPath(config.pathList.editedSource),
    '--out must not overwrite the edited source directory'
  )

  const scopeList = [...config.scopeList].sort((a, b) => a.id - b.id)
  const built = scopeList.map(entry => {
    const path = scopeFilePath(destination, entry.file)
    const data = loadDiffData(config, entry.id) as unknown as PublishedDiffData
    return { path, text: buildScopeFile(config, data), data }
  })
  for (const entry of built) verifyScopeFile(entry.text, entry.data)
  for (const entry of built) {
    const stats = lstatSync(entry.path, { throwIfNoEntry: false })
    ensure(
      stats === undefined || !stats.isSymbolicLink(),
      `--out already holds a symbolic link: ${entry.path}`
    )
  }

  mkdirSync(destination, { recursive: true })
  const written = built.map(entry => {
    writeFileSync(entry.path, entry.text, 'utf-8')
    return entry.path
  })
  return { written, scopes: written.length }
}
