import { roundHalfEven } from './round'

/**
 * 文字数。`.length`はUTF-16コード単位数で、サロゲートペアの文字（絵文字等）を2と数えるため、コードポイントで数える。
 *
 * @param text 文字列。
 * @returns コードポイント数。
 */
export function codePointLength(text: string): number {
  return Array.from(text).length
}

/**
 * 文字数あたりの出現率。小数6桁の偶数丸め。
 *
 * @param count 出現数。
 * @param totalChars 文字数。
 * @returns 分母0のときは0。
 */
export function rate(count: number, totalChars: number): number {
  return totalChars ? roundHalfEven(count / totalChars, 6) : 0.0
}

/**
 * 線形補間のパーセンタイル。
 *
 * @param sortedValueList 昇順にソート済みであること（ここでは検証しない）。
 * @param p 0〜1の分位。
 * @returns 分位点の値。空なら0。
 */
export function percentile(sortedValueList: number[], p: number): number {
  if (sortedValueList.length === 0) return 0
  const k = (sortedValueList.length - 1) * p
  const f = Math.floor(k)
  const c = Math.ceil(k)
  if (f === c) return sortedValueList[Math.trunc(k)]!
  return sortedValueList[f]! + (sortedValueList[c]! - sortedValueList[f]!) * (k - f)
}

/** 文・段落・文書の長さの分布（measurement.md「長さ分布」）。 */
export interface Distribution {
  mean: number
  median: number
  p90: number
}

/**
 * 長さの分布。3値とも小数2桁の偶数丸め。
 *
 * @param valueList 長さの列。
 * @returns 空集合は3値とも0。
 */
export function distribution(valueList: Iterable<number>): Distribution {
  const sorted = [...valueList].sort((a, b) => a - b)
  if (sorted.length === 0) return { mean: 0, median: 0, p90: 0 }
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    mean: roundHalfEven(sum / sorted.length, 2),
    median: roundHalfEven(percentile(sorted, 0.5), 2),
    p90: roundHalfEven(percentile(sorted, 0.9), 2),
  }
}

/**
 * 段落の区切りは空行。単独の改行はソフト改行として段落内にとどまる（measurement.md「段落・文の分割」）。
 *
 * @param text 本文。
 * @returns 空でない段落。前後の空白は除く。
 */
export function splitParagraphList(text: string): string[] {
  return text
    .split(/\n[ \t]*\n(?:[ \t]*\n)*/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
}

/**
 * corpusSizeと長さの分布用。文末分類は別の区切り（`FORENSIC_SENTENCE_SPLIT_RE`）を使う。
 *
 * @param text 本文（段落またはメッセージ）。
 * @returns 空でない文。
 */
export function splitSentenceList(text: string): string[] {
  return text
    .split('。')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

export interface PunctuationCountList {
  kuten: number
  touten: number
  exclamation: number
  question: number
  ellipsis: number
  bracketList: { kagi: number; maru: number; sumitsuki: number }
}

/**
 * 句読点・記号の出現数。複数文書をまとめて数える。
 *
 * @param textList 文書の列。
 * @returns 出現数。
 */
export function punctuationCountList(textList: string[]): PunctuationCountList {
  const joined = textList.join('')
  const matchCount = (re: RegExp) => (joined.match(re) ?? []).length
  const charCount = (ch: string) => joined.split(ch).length - 1
  return {
    kuten: charCount('。'),
    touten: charCount('、'),
    exclamation: matchCount(/[！!]/g),
    question: matchCount(/[？?]/g),
    ellipsis: matchCount(/(?:…+|\.{3,}|・{2,}|。{3,})/g),
    bracketList: {
      kagi: matchCount(/[「」]/g),
      maru: matchCount(/[（）()]/g),
      sumitsuki: matchCount(/[【】]/g),
    },
  }
}

/**
 * 文字n-gram。空白は数えないので先に除く。
 *
 * @param text 本文。
 * @param n gramの長さ。既定は3。
 * @returns n-gramの列（重複あり）。
 */
export function charNgramList(text: string, n = 3): string[] {
  const charList = Array.from(text.replace(/\s+/gu, ''))
  const gramList: string[] = []
  for (let i = 0; i <= charList.length - n; i++) {
    gramList.push(charList.slice(i, i + n).join(''))
  }
  return gramList
}
