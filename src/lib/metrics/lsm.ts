import type { LsmConfig } from './config'
import { roundHalfEven } from './round'
import type { Token } from '../morph'

/** 「かもしれない」の「しれ」。lemmaは書字形の基本形なので、本文の表記（しれる／知れる）ごとに持つ。 */
const MODAL_LEMMA_LIST = new Set(['しれる', '知れる'])
/** 否定助動詞の辞書形。`negations`カテゴリの`lemmaList`と同じ語（`config/lsm_categories.yaml`）。 */
const NEGATION_LEMMA_LIST = new Set(['ない', 'ぬ', 'ず'])

/**
 * 「かもしれない」型の推量構文末尾の否定助動詞の位置。否定ではなく推量の一部なので`negations`に数えない。
 * 仕様（measurement.md「モーダル否定の除外」）により`excludeModalConstruction`の設定値は参照せず常に除外する。
 *
 * @param tokenList 形態素列。
 * @returns 除外する否定助動詞の添字。
 */
function modalNegationIndexList(tokenList: Token[]): Set<number> {
  const modal = new Set<number>()
  for (let i = 0; i < tokenList.length; i++) {
    const token = tokenList[i]!
    if (token.surface !== 'か' || token.pos1 !== '助詞') continue
    const tail = tokenList.slice(i, i + 5)
    if (tail.length < 4 || tail.slice(0, 4).some(t => t.document !== token.document)) continue
    if (tail[1]!.surface !== 'も' || tail[1]!.pos1 !== '助詞') continue
    if (!MODAL_LEMMA_LIST.has(tail[2]!.lemma) || tail[2]!.pos1 !== '動詞') continue
    let j = i + 3
    if (tokenList[j]!.lemma === 'ます') j += 1
    if (
      j < tokenList.length &&
      tokenList[j]!.document === token.document &&
      tokenList[j]!.pos1 === '助動詞' &&
      NEGATION_LEMMA_LIST.has(tokenList[j]!.lemma)
    ) {
      modal.add(j)
    }
  }
  return modal
}

/**
 * LSM10カテゴリそれぞれに該当するトークンの添字。比率の分子と、変更案の出現根拠の両方に使う。
 *
 * @param tokenList 形態素列。
 * @param lsmCfg `config/lsm_categories.yaml`の内容。
 * @returns カテゴリ名 → 添字の配列。
 */
export function lsmCategoryOccurrenceList(
  tokenList: Token[],
  lsmCfg: LsmConfig
): Record<string, number[]> {
  const modalNegationList = modalNegationIndexList(tokenList)
  const result: Record<string, number[]> = {}
  for (const [category, spec] of Object.entries(lsmCfg.categoryList)) {
    const posFilter = spec.posFilter
    // `extraLemmaList`は名前に反して表層一致（measurement.md）。`lemmaList`だけが辞書形一致
    const extraList = new Set(spec.extraLemmaList ?? [])
    const lemmaList = new Set(spec.lemmaList ?? [])
    const indexList: number[] = []
    tokenList.forEach((token, i) => {
      const matched =
        !!posFilter &&
        token.pos1 === posFilter[0] &&
        (posFilter.length < 2 || token.pos2 === posFilter[1])
      if (matched || extraList.has(token.surface) || lemmaList.has(token.lemma)) {
        if (category !== 'negations' || !modalNegationList.has(i)) indexList.push(i)
      }
    })
    result[category] = indexList
  }
  return result
}

/**
 * LSM10カテゴリの使用比率（小数6桁の偶数丸め）。
 *
 * @param tokenList 形態素列。
 * @param lsmCfg `config/lsm_categories.yaml`の内容。
 * @returns 総トークン数が`minTokens`（LSMを算出する最小トークン数。`config/lsm_categories.yaml`）未満ならnull。仕様（measurement.md「LSMの算出」）でLSMを算出しない文書。
 */
export function lsmCategoryRatioList(
  tokenList: Token[],
  lsmCfg: LsmConfig
): Record<string, number> | null {
  const total = tokenList.length
  if (total < lsmCfg.minTokens) return null
  const occurrenceList = lsmCategoryOccurrenceList(tokenList, lsmCfg)
  const ratioList: Record<string, number> = {}
  for (const [category, indexList] of Object.entries(occurrenceList)) {
    ratioList[category] = roundHalfEven(indexList.length / total, 6)
  }
  return ratioList
}

/**
 * 1カテゴリ分の2文書間LSM（measurement.md「LSMの算出」）。
 *
 * @param a 一方の文書の使用比率。
 * @param b 他方の文書の使用比率。
 * @returns 両方の比率が0なら1（0除算を避ける。仕様の「分母が0のときは1」）。
 */
export function lsmPairwiseScore(a: number, b: number): number {
  return a + b ? 1 - Math.abs(a - b) / (a + b) : 1
}

/**
 * 平均LSM。指定カテゴリの単純平均（measurement.md「LSMの算出」）。
 *
 * @param ratioListA 一方の文書のカテゴリ別使用比率。
 * @param ratioListB 他方の文書のカテゴリ別使用比率。
 * @param categoryList 平均に含めるカテゴリ名。
 * @returns 平均LSM。
 */
export function lsmPairwiseMean(
  ratioListA: Record<string, number>,
  ratioListB: Record<string, number>,
  categoryList: string[]
): number {
  const scoreList = categoryList.map(category =>
    lsmPairwiseScore(ratioListA[category]!, ratioListB[category]!)
  )
  return neumaierSum(scoreList) / scoreList.length
}

/**
 * 浮動小数点の丸め誤差を補正しながら合計する（Neumaier法）。単純な逐次加算と最下位ビットが変わることがあり、保存済みJSONの値とビット単位で一致させるために使う。
 *
 * @param valueList 加算する値。
 * @returns 合計。
 */
export function neumaierSum(valueList: number[]): number {
  let sum = 0
  let compensation = 0
  for (const value of valueList) {
    const t = sum + value
    compensation += Math.abs(sum) >= Math.abs(value) ? sum - t + value : value - t + sum
    sum = t
  }
  return sum + compensation
}
