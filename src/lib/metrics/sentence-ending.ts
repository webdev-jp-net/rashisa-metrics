import { roundHalfEven } from './round'

/** 文末表現の7分類。プロファイルの`sentenceEnding.ratioList`のキーと同じ順。 */
export const SENTENCE_ENDING_LABEL_LIST = [
  'desuMasu',
  'daDearu',
  'finalParticle',
  'symbolEnd',
  'emojiEnd',
  'taigenDomeOrOther',
  'noEnding',
] as const

export type SentenceEndingLabel = (typeof SENTENCE_ENDING_LABEL_LIST)[number]

/** お手本媒体の本文に含まれる`:smile:`形式の絵文字ショートコード。n-gramと形態素解析の入力からは除き、文末判定では`emojiEnd`として扱う。 */
export const EMOJI_RE = /:[a-z0-9_\-+]+:/
const EMOJI_RE_GLOBAL = /:[a-z0-9_\-+]+:/g

/**
 * 絵文字ショートコードを除く。n-gramと形態素解析の入力に使う。
 *
 * @param text 本文。
 * @returns ショートコードを除いた本文。
 */
export function stripEmojiShortcodes(text: string): string {
  return text.replace(EMOJI_RE_GLOBAL, '')
}

/** 文末分類にのみ使う文境界の区切り文字。`splitSentenceList`が使う句点のみの分割（corpusSize・長さの分布用）とは別物。 */
export const FORENSIC_SENTENCE_SPLIT_RE = /[。！!？?\n]/

/** 先に一致した分類を採る。`desuMasu`→`daDearu`→`finalParticle`→`symbolEnd`の順（measurement.md「文末表現」）。 */
const SENTENCE_ENDING_PATTERN_LIST: [SentenceEndingLabel, RegExp][] = [
  ['desuMasu', /(です|ます|でした|ました)[。！!？?]*$/],
  ['daDearu', /(だ|である|だった)[。！!？?]*$/],
  ['finalParticle', /(ね|よ|かな|な|わ|の)[。！!？?]*$/],
  ['symbolEnd', /[！!？?…]+$/],
]
/** 末尾が仮名・漢字なら体言止め等。それ以外（英数字・記号）は`noEnding`。 */
const TAIGEN_DOME_RE = /[一-龥ぁ-んァ-ヶー]$/

/**
 * 1文の文末を分類する。`emojiEnd`はここでは返さない。絵文字止めはユニット末尾の条件で決まるため
 * （measurement.md「絵文字止めの補正」）、`classifyUnitSentences`が最後の文のラベルを上書きする。
 *
 * @param sentence 区切り文字を除いた1文。
 * @returns 7分類のうち`emojiEnd`以外。
 */
export function classifySentenceEnding(sentence: string): SentenceEndingLabel {
  for (const [label, pattern] of SENTENCE_ENDING_PATTERN_LIST) {
    if (pattern.test(sentence)) return label
  }
  if (TAIGEN_DOME_RE.test(sentence)) return 'taigenDomeOrOther'
  return 'noEnding'
}

/** 文末分類の集計。`sentences`は分類した文の総数（分母）。 */
export interface SentenceEndingRatios {
  sentences: number
  ratioList: Record<SentenceEndingLabel, number>
}

/** 1ユニット分の文と、同じ並びの分類。`measureDetail`が出現根拠として文を使う。 */
export interface UnitSentences {
  sentenceList: string[]
  labelList: SentenceEndingLabel[]
}

/**
 * 1ユニット（articleなら段落、messageならメッセージ全体）の文を分割・分類する。
 * ユニットが絵文字ショートコードで終わる場合、最後の文を`emojiEnd`にする（文が1つも無ければ
 * ユニット全体を1文とみなす）。末尾40文字以内・末尾が`:`という条件はmeasurement.md「絵文字止めの補正」。
 *
 * @param unit 段落またはメッセージ全体。
 * @param classify 1文の分類関数（通常は`classifySentenceEnding`）。
 * @returns 文と、同じ並びの分類。
 */
export function classifyUnitSentences(
  unit: string,
  classify: (sentence: string) => SentenceEndingLabel
): UnitSentences {
  let sentenceList = unit
    .split(FORENSIC_SENTENCE_SPLIT_RE)
    .map(s => s.trim())
    .filter(s => s.length > 0)
  let labelList = sentenceList.map(classify)
  const rstripped = unit.replace(/\s+$/u, '')
  const tail = rstripped.length ? rstripped.slice(-40) : ''
  if (EMOJI_RE.test(tail) && rstripped.endsWith(':')) {
    if (labelList.length) {
      labelList = [...labelList.slice(0, -1), 'emojiEnd']
    } else {
      sentenceList = [unit]
      labelList = ['emojiEnd']
    }
  }
  return { sentenceList, labelList }
}

/**
 * 文末表現の7分類の比率。
 *
 * @param unitList articleなら段落、messageならメッセージ全体。
 * @param classify 1文の分類関数（通常は`classifySentenceEnding`）。
 * @returns 比率は小数6桁の偶数丸め。文が1つも無ければすべて0。
 */
export function sentenceEndingRatios(
  unitList: string[],
  classify: (sentence: string) => SentenceEndingLabel
): SentenceEndingRatios {
  const countList = new Map<SentenceEndingLabel, number>()
  for (const unit of unitList) {
    const { labelList } = classifyUnitSentences(unit, classify)
    for (const label of labelList) countList.set(label, (countList.get(label) ?? 0) + 1)
  }
  const total = [...countList.values()].reduce((a, b) => a + b, 0)
  const ratioList = {} as Record<SentenceEndingLabel, number>
  for (const label of SENTENCE_ENDING_LABEL_LIST) {
    const c = countList.get(label) ?? 0
    ratioList[label] = total ? roundHalfEven(c / total, 6) : 0.0
  }
  return { sentences: total, ratioList: ratioList }
}
