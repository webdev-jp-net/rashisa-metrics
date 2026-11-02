import type { Token, Tokenizer } from '../morph'
import { loadLsmConfig } from './config'
import { keigoCountList } from './keigo'
import { lsmCategoryRatioList } from './lsm'
import { roundHalfEven } from './round'
import {
  classifySentenceEnding,
  sentenceEndingRatios,
  stripEmojiShortcodes,
} from './sentence-ending'
import {
  charNgramList,
  codePointLength,
  distribution,
  punctuationCountList,
  rate,
  splitParagraphList,
  splitSentenceList,
} from './text-stats'
import type { DocumentType, MeasurementResult, UncomputedField } from './types'

/** `functionWords`に数える品詞。 */
const FUNC_POS_LIST = new Set(['接続詞', '副詞', '助詞'])

/** `documentType`は文の分割単位（article=段落、message=メッセージ全体）を決める。 */
export interface MeasureTextsOptions {
  documentType?: DocumentType
  tokenizer: Tokenizer
}

/**
 * 頻度表（文法語・文字n-gram）を出現数降順・同数はキー昇順に並べる。保存済みプロファイルの並びと一致させる。
 *
 * @param entryList キーと出現数。
 * @param toEntry 出力1件を作る関数。
 * @param total 出現率の分母（文字数）。
 * @returns 並べ替えた出力。
 */
function sortedFrequencyList<T>(
  entryList: [string, number][],
  toEntry: (key: string, count: number, rate: number) => T,
  total: number
): T[] {
  return [...entryList]
    .sort(([keyA, countA], [keyB, countB]) => {
      if (countA !== countB) return countB - countA
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
    })
    .map(([key, count]) => toEntry(key, count, rate(count, total)))
}

/**
 * 1文書群を26指標の計測結果（プロファイル本体と同じ形）にする。
 *
 * @param textList 匿名化済みであること。匿名化は`src/lib/text`の責務なので、ここでは行わない。
 * @param options 計測条件。
 * @param options.tokenizer `NullTokenizer`を渡すと`functionWords`・`lsmCategory`・`politeness`は
 *   すべてnullになり`uncomputed`に列挙される。
 * @returns 計測結果。
 * @throws `documentType`が不正、または空のテキストがあれば止める。
 */
export function measureTexts(textList: string[], options: MeasureTextsOptions): MeasurementResult {
  const documentType: DocumentType = options.documentType ?? 'article'
  if (documentType !== 'article' && documentType !== 'message') {
    throw new Error('documentType must be article or message')
  }
  const list = [...textList]
  if (list.length === 0 || list.some(t => typeof t !== 'string' || t.trim().length === 0)) {
    throw new Error('nonempty text records required')
  }
  const normalized = list.map(t => t.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  const total = normalized.reduce((sum, t) => sum + codePointLength(t), 0)

  const paragraphList = normalized.flatMap(splitParagraphList)
  // 文末分類のユニットは、articleでは段落、messageではメッセージ全体（段落で区切らない）
  const unitList = documentType === 'article' ? paragraphList : normalized
  const sentenceList = unitList.flatMap(splitSentenceList)

  const countList = punctuationCountList(normalized)
  const linebreakPerDocument = roundHalfEven(
    normalized.reduce((sum, t) => sum + (t.match(/\n/g)?.length ?? 0), 0) / normalized.length,
    3
  )
  const punctuation = {
    kuten: rate(countList.kuten, total),
    touten: rate(countList.touten, total),
    exclamation: rate(countList.exclamation, total),
    question: rate(countList.question, total),
    ellipsis: rate(countList.ellipsis, total),
    bracketList: {
      kagi: rate(countList.bracketList.kagi, total),
      maru: rate(countList.bracketList.maru, total),
      sumitsuki: rate(countList.bracketList.sumitsuki, total),
    },
    linebreakPerDocument,
  }

  const content = normalized.map(stripEmojiShortcodes)
  const gramCountList = new Map<string, number>()
  for (const text of content) {
    for (const gram of charNgramList(text))
      gramCountList.set(gram, (gramCountList.get(gram) ?? 0) + 1)
  }

  const missing: UncomputedField[] = [
    { field: 'charNgramSignature.topDistinctive', reason: 'noContrastCorpus' },
    { field: 'vocabulary.distinctiveTermList', reason: 'noContrastCorpus' },
  ]

  let func: Map<string, number> | null = null
  let tokenList: Token[] | null = null
  const tokenizerName = options.tokenizer.name
  if (tokenizerName !== 'none') {
    tokenList = content.flatMap((text, document) => options.tokenizer.tokenize(text, document))
    func = new Map()
    for (const token of tokenList) {
      if (FUNC_POS_LIST.has(token.pos1)) func.set(token.surface, (func.get(token.surface) ?? 0) + 1)
    }
  }
  if (func === null) {
    missing.push({ field: 'functionWords', reason: 'tokenizerUnavailableOrDisabled' })
  }

  const lsmCfg = loadLsmConfig()
  const endings = sentenceEndingRatios(unitList, classifySentenceEnding)

  let lsm: MeasurementResult['lsmCategory'] = null
  let politeness: MeasurementResult['politeness'] = null
  if (tokenList === null) {
    missing.push({ field: 'lsmCategory', reason: 'tokenizerUnavailableOrDisabled' })
    missing.push({ field: 'politeness', reason: 'tokenizerUnavailableOrDisabled' })
  } else {
    const ratioList = lsmCategoryRatioList(tokenList, lsmCfg)
    if (ratioList === null) {
      missing.push({ field: 'lsmCategory', reason: 'belowMinTokens' })
    } else {
      lsm = { ratioList: ratioList, totalTokens: tokenList.length, minTokens: lsmCfg.minTokens }
    }
    const hitList = keigoCountList(tokenList, content.join('\n'))
    const n = tokenList.length || 1 // 形態素0件のときの0除算を避ける
    const politenessResult: MeasurementResult['politeness'] = {}
    let hitTotal = 0
    for (const [key, value] of Object.entries(hitList)) {
      politenessResult[`${key}Per1000Morph`] = roundHalfEven((value / n) * 1000, 3)
      hitTotal += value
    }
    politenessResult.politenessIndexPer1000Morph = roundHalfEven((hitTotal / n) * 1000, 3)
    politenessResult.totalMorphemes = tokenList.length
    politeness = politenessResult
  }

  return {
    schemaVersion: 2,
    measurement: {
      version: 'persona-style-2',
      documentType,
      textState: 'sanitized',
      paragraphRule: 'blank-line-v1',
      sentenceRule: documentType === 'article' ? 'paragraph-kuten-v1' : 'message-kuten-v1',
      rateDenominator: 'sanitizedCharsIncludingWhitespace',
      ngramRule: 'per-document-remove-shortcodes-and-whitespace-3gram',
      tokenizer: tokenizerName,
      sentenceEndingRule: 'forensic-delims-v1',
      lsmDefinition: 'config/lsm_categories.yaml',
      lsmClassificationRule: 'article-quantity-modality-v1',
      keigoDefinition: 'config/keigo_lexicon.yaml',
    },
    corpusSize: {
      documents: normalized.length,
      chars: total,
      paragraphs: paragraphList.length,
      sentences: sentenceList.length,
    },
    sentence: { lengthDist: distribution(sentenceList.map(codePointLength)) },
    paragraph: { lengthDist: distribution(paragraphList.map(codePointLength)) },
    document: { lengthDist: distribution(normalized.map(codePointLength)) },
    punctuation,
    functionWords:
      func === null
        ? null
        : {
            top: sortedFrequencyList(
              [...func.entries()],
              (word, count, r) => ({ word, count, rate: r }),
              total
            ),
          },
    lsmCategory: lsm,
    politeness,
    sentenceEnding: endings,
    charNgramSignature: {
      topFrequency: sortedFrequencyList(
        [...gramCountList.entries()],
        (gram, count, r) => ({ gram, count, rate: r }),
        total
      ),
      topDistinctive: null,
    },
    vocabulary: { distinctiveTermList: null },
    uncomputed: missing,
  }
}
