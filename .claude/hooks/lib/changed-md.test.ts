import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BASH_MARK, changedFileListSince, targetFileList } from './changed-md.ts'
import type { HookInput } from './hook-types.ts'

const MD = new Set(['.md', '.mdx'])
let root = ''

const input = (tool_name: string, file_path?: string): HookInput => ({
  tool_name,
  tool_input: file_path ? { file_path } : {},
  cwd: root,
  session_id: 's',
  hook_event_name: 'PostToolUse',
})

/** mtime を目印より前後にずらして書く（秒単位の粒度でも判定できるよう 10 秒離す） */
const write = (rel: string, offsetSec: number) => {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, 'x')
  const t = Date.now() / 1000 + offsetSec
  utimesSync(full, t, t)
  return full
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'changed-md-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('changedFileListSince', () => {
  test('目印が無ければ空', () => {
    write('a.md', 10)
    expect(changedFileListSince(root, MD)).toEqual([])
  })

  test('目印より新しい .md だけを返す', () => {
    write(BASH_MARK, 0)
    write('old.md', -10)
    const fresh = write('_llm-docs/new.md', 10)
    write('new.txt', 10)
    expect(changedFileListSince(root, MD)).toEqual([fresh])
  })

  test('node_modules と .git は見ない', () => {
    write(BASH_MARK, 0)
    write('node_modules/x.md', 10)
    write('.git/y.md', 10)
    expect(changedFileListSince(root, MD)).toEqual([])
  })
})

describe('targetFiles', () => {
  test('Edit / Write は file_path をそのまま対象にする', () => {
    const f = write('a.md', 0)
    expect(targetFileList(input('Edit', f), root, MD)).toEqual([f])
    expect(targetFileList(input('Write', f), root, MD)).toEqual([f])
  })

  test('Edit でも拡張子が対象外なら空', () => {
    const f = write('a.txt', 0)
    expect(targetFileList(input('Edit', f), root, MD)).toEqual([])
  })

  test('Bash は目印より新しいファイルを対象にする', () => {
    write(BASH_MARK, 0)
    const fresh = write('a.md', 10)
    expect(targetFileList(input('Bash'), root, MD)).toEqual([fresh])
  })

  test('それ以外のツールは空', () => {
    const f = write('a.md', 0)
    expect(targetFileList(input('Read', f), root, MD)).toEqual([])
  })
})

describe('git が無視するファイル', () => {
  const initRepo = (gitignore: string) => {
    Bun.spawnSync(['git', 'init', '-q'], { cwd: root })
    writeFileSync(join(root, '.gitignore'), gitignore)
  }

  test('.gitignore に書いた .md は Edit / Write でも Bash でも対象にならない', () => {
    initRepo('/source/\n')
    write(BASH_MARK, 0)
    const ignored = write('source/原稿 1.md', 10)
    const tracked = write('docs/a.md', 10)
    expect(targetFileList(input('Edit', ignored), root, MD)).toEqual([])
    expect(targetFileList(input('Write', tracked), root, MD)).toEqual([tracked])
    expect(targetFileList(input('Bash'), root, MD)).toEqual([tracked])
  })

  test('git の管理下でなければ何も外さない', () => {
    const f = write('source/a.md', 0)
    expect(targetFileList(input('Edit', f), root, MD)).toEqual([f])
  })
})
