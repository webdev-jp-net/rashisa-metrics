import { createHash } from 'node:crypto'
import { PATTERN_LIST } from './patterns'

/** シリーズの設定（`data/index.json`の1件）の`anonymization.model`／`anonymization.edited`（媒体1つ分の用語・例外・著者用語）。`exceptionList`は個人情報の形をした正規表現一覧（`patterns.ts`の`PATTERN_LIST`）の誤検出を除外する文字列、`authorTerm`は表示時に［著者名］にする用語。 */
export interface AnonymizationConfig {
  termList: string[]
  exceptionList: string[]
  authorTerm: string
}

/**
 * 長い用語から先に並べ、同じ長さなら辞書順にする。短い用語が長い用語の一部を先に消さないための順序。
 *
 * @param termList 用語。
 * @returns 並べ替えた複製。
 */
function sortedTermListLongestFirst(termList: string[]): string[] {
  return [...termList].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * 正規表現を使わない全置換。用語に正規表現の特殊文字が含まれてもそのまま一致させる。
 *
 * @param text 対象。
 * @param term 置換する用語。
 * @param replacement 置換後。
 * @returns 置換結果。
 */
function replaceAllOccurrences(text: string, term: string, replacement: string): string {
  return text.split(term).join(replacement)
}

/**
 * 計測用の匿名化（measurement.md「入力整形」）。用語も、個人情報の形をした正規表現（`PATTERN_LIST`）に一致する箇所も空文字に置換する。結果はそのままトークナイザーへ渡るため、`visible()`の伏せ字マーカーを絶対に含んではならない。
 *
 * @param text 生の本文。
 * @param cfg シリーズの設定の`anonymization`。
 * @returns 計測用テキスト。
 */
export function clean(text: string, cfg: AnonymizationConfig): string {
  let result = text
  for (const term of sortedTermListLongestFirst(cfg.termList)) {
    result = replaceAllOccurrences(result, term, '')
  }
  const exceptionList = new Set(cfg.exceptionList)
  for (const pattern of PATTERN_LIST) {
    result = result.replace(pattern, match => (exceptionList.has(match) ? match : ''))
  }
  return result
}

/**
 * 表示用の伏せ字化（measurement.md「表示用マスキング」）。伏せ字マーカーが計測に混じると数値が変わるため、計測には絶対に使わないこと。
 *
 * @param text 生の本文。
 * @param cfg シリーズの設定の`anonymization`。
 * @returns 表示用テキスト。
 */
export function visible(text: string, cfg: AnonymizationConfig): string {
  let result = text
  const exceptionList = new Set(cfg.exceptionList)
  for (const pattern of PATTERN_LIST.slice(0, -1)) {
    result = result.replace(pattern, match => (exceptionList.has(match) ? match : '［個人情報］'))
  }
  for (const term of sortedTermListLongestFirst(cfg.termList)) {
    result = replaceAllOccurrences(
      result,
      term,
      term === cfg.authorTerm ? '［著者名］' : '［人物名］'
    )
  }
  return result
}

/** 匿名化設定の識別（プロファイルの`measurement.sanitization`の一部）。どの用語リストで匿名化した数値かを後から照合するための記録。 */
export interface SanitationInfo {
  version: string
  termListHash: string
}

/**
 * 匿名化の設定を識別する`version`と`termListHash`。ハッシュ対象の文字列は
 * `["a", "b"]`のようにカンマの後に半角スペースを入れ、非ASCII文字はエスケープしない形式にする必要が
 * ある。JSON.stringify(array)だけではカンマ後のスペースが入らず、異なるハッシュになってしまう。
 *
 * @param termList 匿名化に使った用語。
 * @returns `version`と`termListHash`。
 */
export function sanitationInfo(termList: string[]): SanitationInfo {
  const sorted = Array.from(new Set(termList)).sort()
  const payload = `[${sorted.map(term => JSON.stringify(term)).join(', ')}]`
  const termListHash = createHash('sha256').update(payload, 'utf8').digest('hex')
  return { version: 'basic-pii-and-terms-v1', termListHash: termListHash }
}
