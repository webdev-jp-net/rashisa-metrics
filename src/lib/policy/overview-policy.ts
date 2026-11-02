/** 群ごとの強調の絶対下限（overview-policy.md「強調規則」の「群の最小差」）。 */
export interface AbsoluteLimitList {
  文法語: number
  文末: number
  丁寧度: number
  文長: number
  段落長: number
}

/** 判定規則overview-3の値一式。 */
export interface Policy {
  version: string
  status: string
  relativeLimit: number
  absoluteLimitList: AbsoluteLimitList
  /** Pennebaker (2011)の「高い同期性」の目安値。LSM平均のみこれと比較して判定する。 */
  lsmSynchronyThreshold: number
  close: { minimumLsm: number; maximumCount: number }
  priority: { lsmBelow: number; countAtLeast: number }
}

/** 判定規則の現在値。`version`は`overview_criteria.json`に記録される。 */
export const POLICY: Policy = {
  version: 'overview-3',
  status: 'provisional editorial rules, not author-identification thresholds',
  relativeLimit: 0.2,
  absoluteLimitList: { 文法語: 0.1, 文末: 1, 丁寧度: 1, 文長: 5, 段落長: 5 },
  lsmSynchronyThreshold: 0.85,
  close: { minimumLsm: 0.9, maximumCount: 7 },
  priority: { lsmBelow: 0.88, countAtLeast: 10 },
}

/** スコープの3分類（dictionary.md「分類」）。 */
export type Classification = 'close' | 'priority' | 'targeted'

/**
 * 平均LSMと強調件数からスコープを3分類する。分類はその行の値と判定規則の閾値だけで決まり、他スコープの結果には依存しない（スコープを個別に再計算できる）。
 *
 * @param lsm 平均LSM。
 * @param count 強調件数。
 * @returns 3分類のいずれか。
 */
export function classify(lsm: number, count: number): Classification {
  if (lsm >= POLICY.close.minimumLsm && count <= POLICY.close.maximumCount) return 'close'
  if (lsm < POLICY.priority.lsmBelow || count >= POLICY.priority.countAtLeast) return 'priority'
  return 'targeted'
}

/**
 * 測定された方向だけを表現する。言い回しや原因の推測は行わない。
 *
 * @param group 群名。
 * @param item 項目名。
 * @param difference 編集対象 − お手本。
 * @returns 「〜を上げる／下げる／長くする／短くする」の文。
 */
export function movement(group: string, item: string, difference: number): string {
  if (group === '文長' || group === '段落長') {
    return `${group}の${item}を` + (difference > 0 ? '短くする' : '長くする')
  }
  const noun = group === '文法語' || group === '文末' ? '比率' : '密度'
  return `${item}の${noun}を` + (difference > 0 ? '下げる' : '上げる')
}

/** `makeSummary`が要るLSMカテゴリの最小形。 */
export interface MakeSummaryLsmCategory {
  label: string
  lsm: number
}

/** `makeSummary`が要る比較データの最小形。 */
export interface MakeSummaryDataset {
  lsm: {
    mean: number
    categoryList: MakeSummaryLsmCategory[]
  }
}

/** `makeSummary`が要る一覧列の最小形（`OverviewCriteriaColumn`の部分集合）。 */
export interface MakeSummaryCriterion {
  group: string
  item: string
  valueList: number[]
  /** `counted`がfalseのときのみnull。その場合は参照されない（flaggedRowListがこの値を指すことはない）。 */
  limit: number | null
  flaggedRowList: number[]
  counted: boolean
}

/** スコープ1件の分類結果。`targetList`は寄せる方向を述べる対象列のindex（最大2件）。 */
export interface SummaryAssessment {
  row: number
  label: string
  lsm: number
  count: number
  classification: Classification
  targetList: number[]
}

/** (見出し, 本文)のペア。2要素のJSON配列としてシリアライズされる。 */
export type SummaryNote = [string, string]

/** 総括（`noteList`）と、その根拠になったスコープ別の分類。 */
export interface MakeSummaryResult {
  noteList: SummaryNote[]
  assessmentList: SummaryAssessment[]
}

/**
 * 総括の見出し付き本文を、分類と強調結果からoverview-policy.md「総括文の生成」の規則で組み立てる。
 *
 * @param datasetList 比較データ。先頭が全体スコープ。
 * @param labelList `datasetList`と同じ順のスコープ名。
 * @param countList `datasetList`と同じ順の強調件数。
 * @param criteria 一覧の列。
 * @param modelLabel お手本媒体の表示名。
 * @returns 総括の見出し付き本文と、スコープ別の分類。
 */
export function makeSummary(
  datasetList: MakeSummaryDataset[],
  labelList: string[],
  countList: number[],
  criteria: MakeSummaryCriterion[],
  modelLabel: string
): MakeSummaryResult {
  const assessmentList: SummaryAssessment[] = []
  // datasets[0]は全体スコープなので、個別スコープ（1以降）だけを評価する
  for (let i = 1; i < datasetList.length; i += 1) {
    const data = datasetList[i]
    const score = data.lsm.mean
    const categoryScoreList = new Map(data.lsm.categoryList.map(r => [r.label, r.lsm]))
    let candidateList: number[] = []
    criteria.forEach((c, j) => {
      if (c.flaggedRowList.includes(i) && c.group === '文法語' && c.item !== '数量詞') {
        candidateList.push(j)
      }
    })
    candidateList.sort((a, b) => {
      const ca = categoryScoreList.get(criteria[a].item)!
      const cb = categoryScoreList.get(criteria[b].item)!
      if (ca !== cb) return ca - cb
      return a - b
    })
    // 数量詞は共通特徴として一度だけ言及する。他に文法語の差分が無ければ、
    // 閾値で正規化した差が最も大きい項目を使う。
    if (candidateList.length === 0) {
      candidateList = []
      criteria.forEach((c, j) => {
        if (c.flaggedRowList.includes(i) && c.group !== 'LSM') {
          candidateList.push(j)
        }
      })
      candidateList.sort((a, b) => {
        // ここに到達するのはflagged（included=true）な列のみで、limitは必ずnullでない。
        const ka = -Math.abs(criteria[a].valueList[i]) / criteria[a].limit!
        const kb = -Math.abs(criteria[b].valueList[i]) / criteria[b].limit!
        if (ka !== kb) return ka - kb
        return a - b
      })
    }
    const targetList = candidateList.slice(0, 2)
    assessmentList.push({
      row: i,
      label: labelList[i],
      lsm: score,
      count: countList[i],
      classification: classify(score, countList[i]),
      targetList,
    })
  }

  const groupList: Record<Classification, SummaryAssessment[]> = {
    close: assessmentList.filter(r => r.classification === 'close'),
    priority: assessmentList.filter(r => r.classification === 'priority'),
    targeted: assessmentList.filter(r => r.classification === 'targeted'),
  }
  const names = (kind: Classification) => groupList[kind].map(r => r.label).join('・')

  const noteList: SummaryNote[] = []
  if (groupList.close.length > 0) {
    noteList.push([
      `${modelLabel}への近さを保てている章`,
      names('close') +
        'は、平均LSMが0.90以上かつ差分が7項目以下で、今回の編集基準では近さを保てている章です。語り全体の組み直しより、表で色が付いた項目を絞って調整する方針です。',
    ])
  } else {
    noteList.push([
      `${modelLabel}への近さを保てている章`,
      '今回の編集基準でこの区分に該当する章はありません。',
    ])
  }
  if (groupList.priority.length > 0) {
    noteList.push([
      '調整を優先する章',
      names('priority') +
        `は、平均LSMが0.88未満、または差分が10項目以上です。${modelLabel}から離れている範囲か文法語の使い方に調整余地があり、先に確認する対象です。`,
    ])
    const actionList: string[] = []
    for (const r of groupList.priority) {
      const phraseList = r.targetList.map(j =>
        movement(criteria[j].group, criteria[j].item, criteria[j].valueList[r.row])
      )
      if (phraseList.length > 0) {
        actionList.push(r.label + 'では' + phraseList.join('、'))
      }
    }
    if (actionList.length > 0) {
      noteList.push([
        `優先章で${modelLabel}へ寄せる方向`,
        actionList.join('。') +
          `。この方向で本文中の用例を調整し、再計測して${modelLabel}との差が縮まるかを確認します。`,
      ])
    }
  }
  if (groupList.targeted.length > 0) {
    noteList.push([
      '項目を絞って確認する章',
      names('targeted') +
        `は上の二群の中間です。表の強調項目を対象に、${modelLabel}への近さを部分的に整える方針です。`,
    ])
  }
  const shared = criteria.filter(
    c =>
      c.counted &&
      Array.from({ length: datasetList.length - 1 }, (_, k) => k + 1).every(i =>
        c.flaggedRowList.includes(i)
      ) &&
      (c.valueList.slice(1).every(v => v > 0) || c.valueList.slice(1).every(v => v < 0))
  )
  if (shared.length > 0) {
    const phraseList = shared.map(c => movement(c.group, c.item, c.valueList[1]))
    noteList.push([
      '全編に共通する調整',
      phraseList.join('、') +
        `方向は全${datasetList.length - 1}区分に共通します。これらを通して整え、優先章の追加差分も縮めることで、各章の${modelLabel}への近さを揃えていきます。`,
    ])
  }

  return { noteList, assessmentList: assessmentList }
}
