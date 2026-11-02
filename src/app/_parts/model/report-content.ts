/**
 * @file microCMSから取得した`report`の1コンテンツを、画面が使う内部の形（比較データ・表示材料・総評）へ
 *   組み直す。microCMSは管理画面で確認・修正できるよう型付きのフラットなフィールドで持つため、
 *   入れ子や3要素配列に戻す変換をここに集める。
 */
import type { ComparisonRowEntry, ReportContent } from '@/lib/api/microcms'
import type { ComparisonScopeData, ComparisonTriple } from '@/lib/data/report-data'
import type {
  ScopeMetricMaterial,
  ScopeReasonMaterial,
  ScopeReportMaterial,
} from './scope-proposal'
import type { FindingModel, ViewpointKey } from './types'

/** すべてのスコープには、これらの観点それぞれの総評が必要。 */
const FINDING_AXIS_LIST: ViewpointKey[] = ['lsm', 'endings', 'politeness', 'length']

/**
 * 比較の繰り返しフィールドを、比較データの3要素配列（ラベル・お手本・編集対象）に戻す。
 *
 * @param rowList 繰り返しフィールドの行。
 * @returns 3要素配列の行。
 */
function comparisonTripleList(rowList: ComparisonRowEntry[]): ComparisonTriple[] {
  return rowList.map(row => [row.label, row.model, row.edited])
}

/**
 * 1スコープ分の比較データ。`lsm.formula`・各ブロックの`unit`・`lsm.categoryList[].category`は画面も
 * 一覧の根拠データの計算も読まない記録用の値で、microCMSへ送っていないため空文字列を置く。
 *
 * @param content `report`の1コンテンツ。
 * @returns 比較データ。
 */
export function contentComparisonData(content: ReportContent): ComparisonScopeData {
  return {
    lsm: {
      formula: '',
      categoryList: content.lsmCategoryList.map(row => ({
        category: '',
        label: row.label,
        model: row.model,
        edited: row.edited,
        lsm: row.lsm,
      })),
      mean: content.lsmMean,
    },
    sentenceEnding: { unit: '', rowList: comparisonTripleList(content.sentenceEndingList) },
    politeness: { unit: '', rowList: comparisonTripleList(content.politeness) },
    length: {
      unit: '',
      rowList: {
        sentence: comparisonTripleList(content.sentenceLengthList),
        paragraph: comparisonTripleList(content.paragraphLengthList),
      },
    },
  }
}

/**
 * 1スコープ分の表示材料。`reasonList[].id`は理由行のDOM idにしか使わず、microCMSは変更案のidを持たない
 * ので、送信時と同じ並び順の連番を充てる。
 *
 * @param content `report`の1コンテンツ。
 * @param section スコープid。コンテンツIDの文字列解釈には頼らず、呼び出し元が持つ値をそのまま渡す。
 * @returns 表示材料。`proposalReady`がfalse（変更案が未完了、または全体スコープ）ならnull。
 */
export function contentReportMaterial(
  content: ReportContent,
  section: number
): ScopeReportMaterial | null {
  if (!content.proposalReady) return null

  const reasonList: ScopeReasonMaterial[] = (content.reasonList ?? []).map((reason, index) => ({
    id: String(index),
    line: reason.line,
    title: reason.title,
    reason: reason.reason,
    tradeoff: reason.tradeoff,
  }))
  const metricList: ScopeMetricMaterial[] = (content.metricList ?? []).map(metric => ({
    genre: metric.genre,
    item: metric.item,
    unit: metric.unit,
    model: metric.model,
    before: metric.before,
    after: metric.after,
    target: metric.target,
  }))

  return {
    section,
    beforeText: content.beforeText ?? '',
    afterText: content.afterText ?? '',
    reasonList,
    metricList,
    lsmBefore: content.lsmBefore ?? 0,
    lsmAfter: content.lsmAfter ?? 0,
  }
}

/**
 * 1スコープ分の総評を観点ごとに引ける形にする。`paragraphList`はmicroCMS側で1段落1行の1つの
 * テキストエリアなので、画面が使う段落の配列へ戻す。
 *
 * @param content `report`の1コンテンツ。
 * @returns 4観点の見出しと段落。
 * @throws 4観点（lsm・endings・politeness・length）に過不足があるか、見出し・段落が欠けていれば、
 *   コンテンツIDと観点を名指しして止める。
 */
export function contentFindingList(content: ReportContent): Record<ViewpointKey, FindingModel> {
  const byAxis = new Map<string, FindingModel>()
  for (const entry of content.findingList ?? []) {
    for (const axis of entry.axis ?? []) {
      if (byAxis.has(axis)) {
        throw new Error(`report/${content.id}: duplicate finding for '${axis}'`)
      }
      if (!entry.heading || !entry.paragraphList) {
        throw new Error(`report/${content.id}: missing heading/paragraphList for '${axis}'`)
      }
      byAxis.set(axis, { heading: entry.heading, paragraphList: entry.paragraphList.split('\n') })
    }
  }

  const findingList = {} as Record<ViewpointKey, FindingModel>
  for (const axis of FINDING_AXIS_LIST) {
    const finding = byAxis.get(axis)
    if (finding === undefined) {
      throw new Error(`report/${content.id}: missing heading/paragraphList for '${axis}'`)
    }
    findingList[axis] = finding
  }
  if (byAxis.size !== FINDING_AXIS_LIST.length) {
    const extra = [...byAxis.keys()].filter(
      axis => !FINDING_AXIS_LIST.includes(axis as ViewpointKey)
    )
    throw new Error(`report/${content.id}: unknown finding axis '${extra.join("', '")}'`)
  }
  return findingList
}
