export { roundHalfEven } from './round'
export type { LsmCategorySpec, LsmConfig, KeigoCategorySpec, KeigoConfig } from './config'
export { loadLsmConfig, loadKeigoConfig } from './config'

export type { Distribution, PunctuationCountList } from './text-stats'
export {
  codePointLength,
  rate,
  percentile,
  distribution,
  splitParagraphList,
  splitSentenceList,
  punctuationCountList,
  charNgramList,
} from './text-stats'

export type { SentenceEndingLabel, SentenceEndingRatios } from './sentence-ending'
export {
  SENTENCE_ENDING_LABEL_LIST,
  EMOJI_RE,
  FORENSIC_SENTENCE_SPLIT_RE,
  stripEmojiShortcodes,
  classifySentenceEnding,
  sentenceEndingRatios,
} from './sentence-ending'

export {
  lsmCategoryOccurrenceList,
  lsmCategoryRatioList,
  lsmPairwiseScore,
  lsmPairwiseMean,
} from './lsm'

export type { KeigoHitList } from './keigo'
export { keigoCountList } from './keigo'

export type {
  DocumentType,
  UncomputedField,
  FrequencyEntry,
  GramEntry,
  LsmResult,
  PolitenessResult,
  MeasurementMeta,
  MeasurementResult,
} from './types'

export type { MeasureTextsOptions } from './measure'
export { measureTexts } from './measure'

export type {
  OccurrenceEvidence,
  MetricCount,
  MeasureDetailResult,
  MeasureDetailOptions,
} from './details'
export { measureDetail } from './details'
