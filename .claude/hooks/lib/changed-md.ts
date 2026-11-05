/**
 * Claude Code Hooks — 処理対象ファイルの特定
 *
 * Edit / Write は tool_input.file_path を対象にする。
 * Bash はファイルパスを渡してこないため、PreToolUse で touch した目印
 * （.claude/tmp/.bash-mark）より新しいファイルを対象にする。
 * どちらも、git が無視対象と判定したファイルは外す。
 */

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { HookInput } from './hook-types.ts'

/** Bash 実行前に touch する目印（プロジェクトルート相対） */
export const BASH_MARK = '.claude/tmp/.bash-mark'

/** 走査しないディレクトリ */
const SKIP_DIR_LIST = new Set(['node_modules', '.git'])

/** 目印より新しい対象拡張子のファイル。目印が無ければ空 */
export function changedFileListSince(projectDir: string, extensionList: Set<string>): string[] {
  const mark = join(projectDir, BASH_MARK)
  if (!existsSync(mark)) return []
  const since = lstatSync(mark).mtimeMs
  const found: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (SKIP_DIR_LIST.has(name)) continue
      const full = join(dir, name)
      const stat = lstatSync(full)
      if (stat.isDirectory()) walk(full)
      else if (
        stat.isFile() &&
        extensionList.has(extname(name).toLowerCase()) &&
        stat.mtimeMs >= since
      )
        found.push(full)
    }
  }
  walk(projectDir)
  return found
}

/**
 * git が無視対象と判定したファイル。コミットされないファイルは文書の審査対象にしない。
 * git の管理下でなければ空（何も外さない）
 */
export function ignoredFileList(projectDir: string, fileList: string[]): string[] {
  if (fileList.length === 0) return []
  const isRepository =
    spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: projectDir }).status === 0
  if (!isRepository) return []
  // -z で区切ると、非 ASCII のパスも引用符つきのエスケープにならずそのまま返る
  const result = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
    cwd: projectDir,
    input: fileList.join('\0'),
    encoding: 'utf8',
  })
  // 0 は無視対象あり、1 は無し。それ以外は判定そのものが失敗している
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore に失敗した: ${result.stderr}`)
  }
  return result.stdout
    .split('\0')
    .filter(Boolean)
    .map(path => resolve(projectDir, path))
}

/** フック入力から処理対象のファイル一覧を決める。git が無視対象と判定したファイルは外す */
export function targetFileList(
  input: HookInput,
  projectDir: string,
  extensionList: Set<string>
): string[] {
  const candidateList = candidateFileList(input, projectDir, extensionList)
  const ignoredList = ignoredFileList(projectDir, candidateList)
  return candidateList.filter(filePath => !ignoredList.includes(resolve(projectDir, filePath)))
}

/** ツールの種類ごとに、対象になりうるファイル一覧を決める */
function candidateFileList(
  input: HookInput,
  projectDir: string,
  extensionList: Set<string>
): string[] {
  if (input.tool_name === 'Bash') return changedFileListSince(projectDir, extensionList)
  if (input.tool_name !== 'Edit' && input.tool_name !== 'Write') return []
  const filePath = input.tool_input.file_path as string | undefined
  if (!filePath || !existsSync(filePath)) return []
  if (!extensionList.has(extname(filePath).toLowerCase())) return []
  return [filePath]
}
