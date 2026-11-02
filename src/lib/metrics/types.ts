import type { Distribution } from './text-stats'
import type { SentenceEndingRatios } from './sentence-ending'

export type { Distribution } from './text-stats'
export type { SentenceEndingLabel, SentenceEndingRatios } from './sentence-ending'

/** 文の分割単位と、計測メタに記録する文分割規則名（`sentenceRule`）を決める。articleは段落、messageはメッセージ全体。 */
export type DocumentType = 'article' | 'message'

/** 計測しなかった指標とその理由。解析器なし（`NullTokenizer`）や対照コーパスなしのとき。 */
export interface UncomputedField {
  field: string
  reason: string
}

export interface FrequencyEntry {
  word: string
  count: number
  rate: number
}

export interface GramEntry {
  gram: string
  count: number
  rate: number
}

/** LSM10カテゴリの使用比率と、その分母。 */
export interface LsmResult {
  ratioList: Record<string, number>
  totalTokens: number
  minTokens: number
}

/** `{sonkeigo,kenjougo,teineigo,politenessIndex}Per1000Morph`と`totalMorphemes`を持つ。 */
export interface PolitenessResult {
  [key: string]: number
}

/** 計測条件の記録。プロファイルの`meta.measurement`と同じ形。 */
export interface MeasurementMeta {
  version: string
  documentType: DocumentType
  textState: string
  paragraphRule: string
  sentenceRule: string
  rateDenominator: string
  ngramRule: string
  tokenizer: string
  sentenceEndingRule: string
  lsmDefinition: string
  lsmClassificationRule: string
  keigoDefinition: string
}

/** `measureTexts`の結果。保存済みプロファイル本体（`StylometricProfile`）とフィールドを共有する。 */
export interface MeasurementResult {
  schemaVersion: 2
  measurement: MeasurementMeta
  corpusSize: { documents: number; chars: number; paragraphs: number; sentences: number }
  sentence: { lengthDist: Distribution }
  paragraph: { lengthDist: Distribution }
  document: { lengthDist: Distribution }
  punctuation: {
    kuten: number
    touten: number
    exclamation: number
    question: number
    ellipsis: number
    bracketList: { kagi: number; maru: number; sumitsuki: number }
    linebreakPerDocument: number
  }
  functionWords: { top: FrequencyEntry[] } | null
  lsmCategory: LsmResult | null
  politeness: PolitenessResult | null
  sentenceEnding: SentenceEndingRatios
  charNgramSignature: { topFrequency: GramEntry[]; topDistinctive: null }
  vocabulary: { distinctiveTermList: null }
  uncomputed: UncomputedField[]
}
