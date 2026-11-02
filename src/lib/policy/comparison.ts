import { relative } from 'node:path'
import { lsmPairwiseScore, neumaierSum } from '../metrics/lsm'
import { sha256File } from '../data/json-io'
import type {
  ComparisonChapterAxisList,
  ComparisonChapterFile,
  ComparisonScopeData,
  ComparisonTotalFile,
  ComparisonTriple,
  LsmComparisonRow,
} from '../data/report-data'
import type {
  LengthDist,
  PolitenessStats,
  SentenceEndingRatioList,
  StylometricProfile,
} from '../data/types'

/**
 * LSM10カテゴリの（プロファイルのキー, 表示名）。以下4表とも配列順が出力JSONとレポートの表示順に
 * そのまま反映される。順序を変えると`build-report`の`--check`（再生成結果と保存済みファイルの照合）も不一致になる。
 */
const CATEGORY_LIST: [keyof StylometricProfile['lsmCategory']['ratioList'], string][] = [
  ['caseParticles', '格助詞'],
  ['bindingParticles', '係助詞'],
  ['conjunctiveParticles', '接続助詞'],
  ['finalParticles', '終助詞'],
  ['auxiliaries', '助動詞'],
  ['conjunctions', '接続詞'],
  ['pronouns', '代名詞'],
  ['adverbs', '副詞'],
  ['negations', '否定'],
  ['quantifiers', '数量詞'],
]

/** 文末7分類の（プロファイルのキー, 表示名）。 */
const ENDING_KEY_LIST: [keyof SentenceEndingRatioList, string][] = [
  ['desuMasu', 'です・ます'],
  ['taigenDomeOrOther', '体言止め等'],
  ['noEnding', '文末なし'],
  ['finalParticle', '終助詞止め'],
  ['symbolEnd', '記号止め'],
  ['daDearu', 'だ・である'],
  ['emojiEnd', '絵文字止め'],
]

/** 敬語3分類＋合計の（プロファイルのキー, 表示名）。 */
const POLITENESS_KEY_LIST: [keyof PolitenessStats, string][] = [
  ['teineigoPer1000Morph', '丁寧語'],
  ['sonkeigoPer1000Morph', '尊敬語'],
  ['kenjougoPer1000Morph', '謙譲語'],
  ['politenessIndexPer1000Morph', '合計'],
]

/** 長さ分布3統計量の（プロファイルのキー, 表示名）。 */
const STAT_LIST: [keyof LengthDist, string][] = [
  ['mean', '平均'],
  ['median', '中央値'],
  ['p90', '90%点'],
]

/** 各軸の棒グラフ表示上限（固定値、算出値ではない）。 */
export const CHAPTER_AXIS_LIST: ComparisonChapterAxisList = {
  endings: 80,
  politeness: 50,
  sentence: 80,
  paragraph: 200,
}

/**
 * LSM10カテゴリの比較行。
 *
 * @param model お手本媒体のプロファイル本体。
 * @param edited 編集対象媒体のプロファイル本体。
 * @returns 10行。
 * @throws 両媒体とも比率0のカテゴリがあれば止める。
 */
export function lsmRowList(
  model: StylometricProfile,
  edited: StylometricProfile
): LsmComparisonRow[] {
  return CATEGORY_LIST.map(([key, label]) => {
    const a = model.lsmCategory.ratioList[key]
    const b = edited.lsmCategory.ratioList[key]
    if (a + b <= 0) {
      throw new Error(`lsm_rows: ${key} model+edited must be > 0`)
    }
    return { category: key, label, model: a, edited: b, lsm: lsmPairwiseScore(a, b) }
  })
}

/**
 * 全体スコープとスコープ別で計算式が食い違わないよう、比較処理をここに共通化している。
 *
 * @param model お手本媒体のプロファイル本体。
 * @param edited 比較する側のプロファイル本体（全体またはスコープ）。
 * @returns 4観点の比較値。
 */
function scopeData(model: StylometricProfile, edited: StylometricProfile): ComparisonScopeData {
  const lsm = lsmRowList(model, edited)
  const mean = neumaierSum(lsm.map(row => row.lsm)) / lsm.length
  const endingList: ComparisonTriple[] = ENDING_KEY_LIST.map(([key, label]) => [
    label,
    model.sentenceEnding.ratioList[key] * 100,
    edited.sentenceEnding.ratioList[key] * 100,
  ])
  const politeness: ComparisonTriple[] = POLITENESS_KEY_LIST.map(([key, label]) => [
    label,
    model.politeness[key],
    edited.politeness[key],
  ])
  const length = {
    sentence: STAT_LIST.map(([stat, label]): ComparisonTriple => [
      label,
      model.sentence.lengthDist[stat],
      edited.sentence.lengthDist[stat],
    ]),
    paragraph: STAT_LIST.map(([stat, label]): ComparisonTriple => [
      label,
      model.paragraph.lengthDist[stat],
      edited.paragraph.lengthDist[stat],
    ]),
  }
  return {
    lsm: { formula: '1 - abs(a-b)/(a+b)', categoryList: lsm, mean },
    sentenceEnding: { unit: 'percent', rowList: endingList },
    politeness: { unit: 'per 1000 morphemes', rowList: politeness },
    length: { unit: 'characters', rowList: length },
  }
}

/**
 * 全体スコープの比較値。
 *
 * @param model お手本媒体のプロファイル本体。
 * @param edited 編集対象媒体（全体）のプロファイル本体。
 * @returns 4観点の比較値。
 */
export function totalScope(
  model: StylometricProfile,
  edited: StylometricProfile
): ComparisonScopeData {
  return scopeData(model, edited)
}

/**
 * 個別スコープの比較値。全体と違い棒グラフの上限（`axisList`）を持つ。
 *
 * @param model お手本媒体のプロファイル本体。
 * @param chapter 編集対象媒体の1スコープ分のプロファイル本体。
 * @returns 4観点の比較値と棒グラフ上限。
 */
export function chapterScope(
  model: StylometricProfile,
  chapter: StylometricProfile
): ComparisonScopeData & { axisList: ComparisonChapterAxisList } {
  return { axisList: CHAPTER_AXIS_LIST, ...scopeData(model, chapter) }
}

/** `buildComparisonTotalFile`の入力。パスは`sourceList[]`の記録用（相対パスとsha256）。 */
export interface BuildComparisonTotalParams {
  root: string
  modelPath: string
  editedPath: string
  model: StylometricProfile
  edited: StylometricProfile
}

/**
 * `comparison_data.json`（全体スコープ）の内容。`sourceList[]`に入力プロファイルの所在とハッシュを残す。
 *
 * @param params 入力プロファイルとそのパス。
 * @returns ファイル内容。
 */
export function buildComparisonTotalFile(params: BuildComparisonTotalParams): ComparisonTotalFile {
  const { root, modelPath, editedPath, model, edited } = params
  const data = totalScope(model, edited)
  return {
    sourceList: [
      {
        path: relative(root, modelPath),
        sha256: sha256File(modelPath),
        corpusSize: model.meta.corpusSize,
        sourceFileList: model.meta.sourceFileList,
      },
      {
        path: relative(root, editedPath),
        sha256: sha256File(editedPath),
        corpusSize: edited.meta.corpusSize,
        sourceFileList: edited.meta.sourceFileList,
      },
    ],
    comparisonScope: 'saved profiles; same sanitation on both media; descriptive only',
    ...data,
  }
}

/** `buildComparisonChapterFile`の入力。パスは`sourceList[]`の記録用（相対パスとsha256）。 */
export interface BuildComparisonChapterParams {
  root: string
  scope: number
  label: string
  modelPath: string
  chapterPath: string
  model: StylometricProfile
  chapter: StylometricProfile
}

/**
 * `comparison_dataN.json`（個別スコープ）の内容。
 *
 * @param params 入力プロファイルとそのパス、スコープidとラベル。
 * @returns ファイル内容。
 */
export function buildComparisonChapterFile(
  params: BuildComparisonChapterParams
): ComparisonChapterFile {
  const { root, scope, label, modelPath, chapterPath, model, chapter } = params
  const data = chapterScope(model, chapter)
  return {
    section: scope,
    label,
    sourceList: [
      {
        path: relative(root, modelPath),
        sha256: sha256File(modelPath),
        corpusSize: model.meta.corpusSize,
      },
      {
        path: relative(root, chapterPath),
        sha256: sha256File(chapterPath),
        corpusSize: chapter.meta.corpusSize,
      },
    ],
    ...data,
  }
}
