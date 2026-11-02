import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { serializeJson } from '../data/json-io'

export { serializeJson } from '../data/json-io'

/**
 * ワークフローの前提条件チェック。失敗はすべてこの例外で止め、`runCli`がメッセージだけを表示する。
 *
 * @param condition 満たすべき条件。
 * @param message 失敗時に表示する文言。
 * @throws `condition`が偽なら`message`で止める。
 */
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/**
 * 出力先ディレクトリが無くても作る（`data/<seriesKey>/propose`は初回に存在しない）。
 *
 * @param path 書き込み先。
 * @param value 書き出す値。
 */
export function saveJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, serializeJson(value), 'utf-8')
}

/**
 * publishの`--check`（生成結果が公開済みファイルと一致するかの検証）に使う。オブジェクトはキー順を問わないが、配列は要素順も一致を求める。
 *
 * @param a 比較対象。
 * @param b 比較対象。
 * @returns 構造が等しければtrue。
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const leftKeyList = Object.keys(left)
  const rightKeyList = Object.keys(right)
  if (leftKeyList.length !== rightKeyList.length) return false
  return leftKeyList.every(
    key => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key])
  )
}
