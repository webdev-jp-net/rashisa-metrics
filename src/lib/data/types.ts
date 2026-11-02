export interface CorpusSize {
  documents: number;
  chars: number;
  paragraphs: number;
  sentences: number;
}

export interface LengthDist {
  mean: number;
  median: number;
  p90: number;
}

export interface LengthStat {
  lengthDist: LengthDist;
}

export interface BracketPunctuation {
  kagi: number;
  maru: number;
  sumitsuki: number;
}

export interface PunctuationStats {
  kuten: number;
  touten: number;
  exclamation: number;
  question: number;
  ellipsis: number;
  bracketList: BracketPunctuation;
  linebreakPerDocument: number;
}

export interface FunctionWordEntry {
  word: string;
  count: number;
  rate: number;
}

export interface FunctionWordStats {
  top: FunctionWordEntry[];
}

export interface LsmCategoryRatioList {
  caseParticles: number;
  bindingParticles: number;
  conjunctiveParticles: number;
  finalParticles: number;
  auxiliaries: number;
  conjunctions: number;
  pronouns: number;
  adverbs: number;
  negations: number;
  quantifiers: number;
}

export interface LsmCategoryStats {
  ratioList: LsmCategoryRatioList;
  totalTokens: number;
  minTokens: number;
}

export interface PolitenessStats {
  sonkeigoPer1000Morph: number;
  kenjougoPer1000Morph: number;
  teineigoPer1000Morph: number;
  politenessIndexPer1000Morph: number;
  totalMorphemes: number;
}

export interface SentenceEndingRatioList {
  desuMasu: number;
  daDearu: number;
  finalParticle: number;
  symbolEnd: number;
  emojiEnd: number;
  taigenDomeOrOther: number;
  noEnding: number;
}

export interface SentenceEndingStats {
  sentences: number;
  ratioList: SentenceEndingRatioList;
}

export interface CharNgramEntry {
  gram: string;
  count: number;
  rate: number;
}

export interface CharNgramSignature {
  topFrequency: CharNgramEntry[];
  topDistinctive: unknown[] | null;
}

export interface VocabularyStats {
  distinctiveTermList: unknown[] | null;
}

export interface UncomputedField {
  field: string;
  reason: string;
}

export interface SanitizationInfo {
  version: string;
  termListHash: string;
  nonPiiExceptionList?: string[];
}

export interface MeasurementMeta {
  version: string;
  documentType: string;
  textState: string;
  paragraphRule: string;
  sentenceRule: string;
  rateDenominator: string;
  ngramRule: string;
  tokenizer: string;
  sentenceEndingRule: string;
  lsmDefinition: string;
  lsmClassificationRule: string;
  keigoDefinition: string;
  /** 匿名化済み（用語・個人情報を除去した）テキストで計測した場合のみ存在する。 */
  sanitization?: SanitizationInfo;
}

/**
 * 保存済みプロファイルとdiff_dataの`measurementList`は、同じ計測結果を違う形で持つ（プロファイルは計測条件・
 * コーパスサイズ等を`meta`キー配下に置き、`measurementList`は同じ項目をトップレベルに持つ）。
 * 両方の形を読めるよう、共通部分だけ型を共有する。
 */
export interface MeasurementCore {
  sentence: LengthStat;
  paragraph: LengthStat;
  document: LengthStat;
  punctuation: PunctuationStats;
  functionWords: FunctionWordStats;
  lsmCategory: LsmCategoryStats;
  politeness: PolitenessStats;
  sentenceEnding: SentenceEndingStats;
  charNgramSignature: CharNgramSignature;
  vocabulary: VocabularyStats;
  uncomputed: UncomputedField[];
}

export interface MeasurementResult extends MeasurementCore {
  schemaVersion: number;
  measurement: MeasurementMeta;
  corpusSize: CorpusSize;
}

/** 計測に使った1文書。`sourceRef`はファイル名から`.md`を除いた文字列、`path`はリポジトリルートからの相対パス。 */
export interface SourceFile {
  sourceRef: string;
  path: string;
  sha256: string;
}

export interface ProfileMeta {
  register: string;
  corpusSize: CorpusSize;
  textState: string;
  measurement: MeasurementMeta;
  schemaVersion: number;
  /** 原資料ディレクトリの相対パス。 */
  sourceDir: string;
  /** 計測に使った文書の順。 */
  sourceFileList: SourceFile[];
  /** 文書の前処理規則の識別子。 */
  preprocessingRule: string;
}

export interface StylometricProfile extends MeasurementCore {
  meta: ProfileMeta;
}

export interface StylometricProfileFile {
  stylometricProfile: StylometricProfile;
}
