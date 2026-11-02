import type { Token, Tokenizer } from '../morph'
import { loadKeigoConfig, loadLsmConfig } from './config'
import { lsmCategoryOccurrenceList } from './lsm'
import { measureTexts } from './measure'
import {
  classifySentenceEnding,
  classifyUnitSentences,
  SENTENCE_ENDING_LABEL_LIST,
  stripEmojiShortcodes,
  type SentenceEndingLabel,
} from './sentence-ending'
import { splitParagraphList } from './text-stats'
import type { DocumentType, MeasurementResult } from './types'

/** 比率指標の分子（出現数）に数えた1出現。`rule`は一致した規則（辞書形一致は`lemma`、正規表現一致はそのパターン、文末分類はラベル名）。 */
export interface OccurrenceEvidence {
  surface: string
  lemma?: string
  rule?: string
}

/** 1指標の分子・分母と、分子に数えた出現。 */
export interface MetricCount {
  numerator: number
  denominator: number
  occurrenceList: OccurrenceEvidence[]
}

/** `countList`のキーは指標path（例: `lsmCategory.ratioList.caseParticles`）。 */
export interface MeasureDetailResult {
  profile: MeasurementResult
  countList: Record<string, MetricCount>
}

export interface MeasureDetailOptions {
  documentType?: DocumentType
}

/**
 * 出現1件を作る。省略可能なフィールドはundefinedのキー自体を持たせない。
 *
 * @param surface 表層形。
 * @param lemma 辞書形（辞書形一致のとき）。
 * @param rule 一致した規則。
 * @returns 出現1件。
 */
function occurrence(surface: string, lemma?: string, rule?: string): OccurrenceEvidence {
  const value: OccurrenceEvidence = { surface }
  if (lemma !== undefined) value.lemma = lemma
  if (rule !== undefined) value.rule = rule
  return value
}

/**
 * 1スコープ本文を計測し、変更案が対象にできる比率指標について分子・分母・出現根拠も返す。
 * 比率だけでは、分子の増減がお手本へ寄せる方向と一致しない見かけの改善（`denominatorOnly`）を
 * 見分けられないため。
 *
 * @param text `clean()`で匿名化済みであること。匿名化は`src/lib/text`の責務なので、ここでは行わない。
 * @param tokenizer 形態素解析器。
 * @param options `documentType`（既定はarticle）。
 * @returns 計測結果と指標ごとの分子・分母・出現根拠。
 */
export function measureDetail(
  text: string,
  tokenizer: Tokenizer,
  options: MeasureDetailOptions = {}
): MeasureDetailResult {
  const documentType = options.documentType ?? 'article'
  const lsmCfg = loadLsmConfig()
  const keigoCfg = loadKeigoConfig()

  const profile = measureTexts([text], { documentType, tokenizer })

  const content = stripEmojiShortcodes(text)
  const tokenList: Token[] = tokenizer.tokenize(content, 0)

  const countList: Record<string, MetricCount> = {}

  for (const [category, indexList] of Object.entries(
    lsmCategoryOccurrenceList(tokenList, lsmCfg)
  )) {
    countList[`lsmCategory.ratioList.${category}`] = {
      numerator: indexList.length,
      denominator: tokenList.length,
      occurrenceList: indexList.map(i => occurrence(tokenList[i]!.surface, tokenList[i]!.lemma)),
    }
  }

  const unitList = splitParagraphList(text)
  const sentenceList: string[] = []
  const endingLabelList: SentenceEndingLabel[] = []
  for (const unit of unitList) {
    const { sentenceList: partList, labelList } = classifyUnitSentences(
      unit,
      classifySentenceEnding
    )
    sentenceList.push(...partList)
    endingLabelList.push(...labelList)
  }
  for (const label of SENTENCE_ENDING_LABEL_LIST) {
    const occurrenceList: OccurrenceEvidence[] = []
    sentenceList.forEach((sentence, i) => {
      if (endingLabelList[i] === label) occurrenceList.push(occurrence(sentence, undefined, label))
    })
    countList[`sentenceEnding.ratioList.${label}`] = {
      numerator: occurrenceList.length,
      denominator: endingLabelList.length,
      occurrenceList,
    }
  }

  const normalized = content
  for (const category of ['teineigo', 'sonkeigo', 'kenjougo'] as const) {
    const cat = keigoCfg[category]
    const lemmaSet = new Set(cat.lemmaList ?? [])
    const occurrenceList: OccurrenceEvidence[] = tokenList
      .filter(t => lemmaSet.has(t.lemma))
      .map(t => occurrence(t.surface, t.lemma, 'lemma'))
    for (const pattern of cat.surfacePatternList ?? []) {
      const re = new RegExp(pattern, 'g')
      for (const m of normalized.matchAll(re)) {
        occurrenceList.push(occurrence(m[0], undefined, pattern))
      }
    }
    countList[`politeness.${category}Per1000Morph`] = {
      numerator: occurrenceList.length,
      denominator: tokenList.length,
      occurrenceList,
    }
  }

  return { profile, countList }
}
