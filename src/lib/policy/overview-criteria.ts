import { sha256File } from '../data/json-io'
import type {
  ComparisonScopeData,
  OverviewCriteria,
  OverviewCriteriaColumn,
  OverviewCriteriaComment,
} from '../data/report-data'
import { makeSummary, movement, POLICY } from './overview-policy'

type ScopeLike = ComparisonScopeData

/** 一覧の1列。`get`は比較データから列の値（お手本との差。LSM平均のみ値そのもの）を取り出す。`featured`は現在どのコードも読まない。 */
interface Column {
  group: string
  item: string
  unit: string
  get: (d: ScopeLike) => number
  featured: boolean
}

const REL_LIMIT = POLICY.relativeLimit
const ABS_LIMIT_LIST = POLICY.absoluteLimitList
const LSM_SYNCHRONY_THRESHOLD = POLICY.lsmSynchronyThreshold

/**
 * 一覧の28列（LSM平均1・文法語10・文末7・丁寧度4・文長3・段落長3）を、比較データの表の並び順で作る（overview-policy.md）。
 *
 * @param total 全体スコープの比較データ（列の並びと項目名の出典）。
 * @returns 28列。
 */
function buildColumnList(total: ScopeLike): Column[] {
  const columnList: Column[] = [
    { group: 'LSM', item: '平均', unit: '類似度', get: d => d.lsm.mean, featured: true },
  ]

  total.lsm.categoryList.forEach((category, i) => {
    columnList.push({
      group: '文法語',
      item: category.label,
      unit: 'ポイント',
      get: d => 100 * (d.lsm.categoryList[i].edited - d.lsm.categoryList[i].model),
      featured: false,
    })
  })

  const endingListFeatured = new Set(['です・ます', '終助詞止め'])
  total.sentenceEnding.rowList.forEach((row, i) => {
    columnList.push({
      group: '文末',
      item: row[0],
      unit: 'ポイント',
      get: d => d.sentenceEnding.rowList[i][2] - d.sentenceEnding.rowList[i][1],
      featured: endingListFeatured.has(row[0]),
    })
  })

  const politenessFeatured = new Set(['丁寧語', '謙譲語'])
  total.politeness.rowList.forEach((row, i) => {
    columnList.push({
      group: '丁寧度',
      item: row[0],
      unit: '‰',
      get: d => d.politeness.rowList[i][2] - d.politeness.rowList[i][1],
      featured: politenessFeatured.has(row[0]),
    })
  })

  ;(['sentence', 'paragraph'] as const).forEach(kind => {
    const title = kind === 'sentence' ? '文長' : '段落長'
    total.length.rowList[kind].forEach((row, i) => {
      columnList.push({
        group: title,
        item: row[0],
        unit: '字',
        get: d => d.length.rowList[kind][i][2] - d.length.rowList[kind][i][1],
        featured: true,
      })
    })
  })

  return columnList
}

/**
 * 強調の相対基準に使うお手本媒体の値。
 *
 * @param total 全体スコープの比較データ。
 * @param group 群名。
 * @param name 項目名。
 * @returns 文法語は百分率に換算。該当列が無い群（LSM平均）はnull。
 */
function baseline(total: ScopeLike, group: string, name: string): number | null {
  if (group === '文法語') {
    const row = total.lsm.categoryList.find(r => r.label === name)
    return row ? row.model * 100 : null
  }
  if (group === '文末' || group === '丁寧度') {
    const rowList = group === '文末' ? total.sentenceEnding.rowList : total.politeness.rowList
    const row = rowList.find(r => r[0] === name)
    return row ? row[1] : null
  }
  if (group === '文長' || group === '段落長') {
    const rowList =
      group === '文長' ? total.length.rowList.sentence : total.length.rowList.paragraph
    const row = rowList.find(r => r[0] === name)
    return row ? row[1] : null
  }
  return null
}

/** `sourceList[]`の記録用。`comparisonFile`はファイル名、`path`はハッシュを取る実パス。 */
export interface OverviewCriteriaSourceFile {
  comparisonFile: string
  path: string
}

/** `datasetList`・`overviewLabelList`・`sourceFileList`は同じ順序の並行配列で、先頭（index 0）が全体スコープ。 */
export interface ComputeOverviewCriteriaParams {
  datasetList: ScopeLike[]
  overviewLabelList: string[]
  sourceFileList: OverviewCriteriaSourceFile[]
  modelLabel: string
}

/**
 * `overview_criteria.json`の内容。強調（`flaggedRowList`）・件数・分類・寸評・総括をoverview-policy.mdの規則で決める。
 *
 * @param params 全スコープの比較データと、記録用のラベル・ファイル情報。
 * @returns ファイル内容。
 * @throws 寸評本文が200字を超えれば止める（overview-policy.md「overview_criteria.json」）。
 */
export function computeOverviewCriteria(params: ComputeOverviewCriteriaParams): OverviewCriteria {
  const { datasetList, overviewLabelList, sourceFileList, modelLabel } = params
  const columnList = buildColumnList(datasetList[0])
  const columnValueList = columnList.map(c => datasetList.map(d => c.get(d)))
  const columnEmphasis: Set<number>[] = []
  const criteria: OverviewCriteriaColumn[] = []

  columnList.forEach((column, colIndex) => {
    const valueList = columnValueList[colIndex]
    let included: boolean
    let limit: number | null
    let reference: number | null
    let flagged: Set<number>
    if (column.group === 'LSM' && column.item === '平均') {
      included = true
      limit = LSM_SYNCHRONY_THRESHOLD
      reference = null
      flagged = new Set(valueList.flatMap((value, i) => (value < limit! ? [i] : [])))
    } else {
      included = column.group !== 'LSM' && column.item !== '合計'
      reference = baseline(datasetList[0], column.group, column.item)
      limit = included
        ? Math.max(
            REL_LIMIT * (reference ?? 0),
            ABS_LIMIT_LIST[column.group as keyof typeof ABS_LIMIT_LIST]
          )
        : null
      flagged = new Set(
        valueList.flatMap((value, i) => (included && Math.abs(value) > limit! + 1e-12 ? [i] : []))
      )
    }
    columnEmphasis.push(flagged)
    criteria.push({
      group: column.group,
      item: column.item,
      unit: column.unit,
      counted: included,
      model: reference,
      limit,
      valueList,
      flaggedRowList: Array.from(flagged).sort((a, b) => a - b),
    })
  })

  const countList = datasetList.map(
    (_, i) => columnEmphasis.filter(flagged => flagged.has(i)).length
  )

  // 寸評はスコープの保存済み計測値と固定の閾値だけを使う。orderは寸評に挙げる項目の優先順（先頭から最大2件）
  const order: [string, string][] = [
    ['文法語', '数量詞'],
    ['文法語', '終助詞'],
    ['段落長', '中央値'],
    ['丁寧度', '丁寧語'],
    ['丁寧度', '謙譲語'],
    ['文末', 'です・ます'],
  ]
  const commentList: OverviewCriteriaComment[] = []
  for (let index = 1; index < datasetList.length; index += 1) {
    const d = datasetList[index]
    const score = d.lsm.mean
    const candidateList: string[] = []
    for (const [group, name] of order) {
      const j = columnList.findIndex(c => c.group === group && c.item === name)
      if (j !== -1 && columnEmphasis[j].has(index)) {
        const value = columnValueList[j][index]
        const noun =
          group === '文法語' && name === '終助詞'
            ? '文中も含む終助詞'
            : group === '段落長'
              ? '段落長の中央値'
              : name
        let direction = group === '段落長' ? '長い' : '多い'
        if (value < 0) direction = group === '段落長' ? '短い' : '少ない'
        candidateList.push(`${noun}が${modelLabel}より${direction}`)
      }
    }
    const selected: number[] = []
    for (const [group, name] of order) {
      for (let j = 0; j < columnList.length; j += 1) {
        if (
          columnList[j].group === group &&
          columnList[j].item === name &&
          columnEmphasis[j].has(index)
        ) {
          selected.push(j)
        }
      }
    }
    const selectedTop = selected.slice(0, 2)
    let action = selectedTop
      .map(j => movement(columnList[j].group, columnList[j].item, columnValueList[j][index]))
      .join('、')
    action = action
      ? `${action}方向に調整すると、これらの項目で${modelLabel}へ近づきます。`
      : '寸評の対象項目は暫定の許容幅内です。'
    const bulletList = candidateList.slice(0, 2)
    const text = `平均LSM ${score.toFixed(3)}。${bulletList.join('。')}。${action}`
    // 寸評本文は仕様上200字以内（_llm-docs/analysis/overview-policy.md）
    if (text.length > 200) {
      throw new Error(`overview comment exceeds 200 characters: ${overviewLabelList[index]}`)
    }
    commentList.push({
      label: overviewLabelList[index],
      lsm: score,
      bulletList,
      action,
      text,
    })
  }

  const { noteList, assessmentList: assessmentList } = makeSummary(
    datasetList,
    overviewLabelList,
    countList,
    criteria,
    modelLabel
  )

  return {
    method:
      'abs(edited-model) > max(0.2*model, group_minimum); tolerance 1e-12. ' +
      `LSM平均のみ例外でPennebaker(2011)のhigh synchrony目安(${LSM_SYNCHRONY_THRESHOLD})未満で計上。`,
    status: 'provisional editorial threshold, not empirically calibrated',
    relativeLimit: REL_LIMIT,
    absoluteLimitList: ABS_LIMIT_LIST,
    lsmSynchronyThreshold: LSM_SYNCHRONY_THRESHOLD,
    excluded: ['敬語合計'],
    policy: POLICY,
    sourceList: sourceFileList.map(f => ({
      comparisonFile: f.comparisonFile,
      sha256: sha256File(f.path),
    })),
    // 比較列28列から敬語合計（counted=false）を除いた計上対象の列数
    countDenominator: 27,
    labelList: overviewLabelList,
    countList,
    columnList: criteria,
    commentList,
    assessmentList,
    summary: noteList,
  }
}
