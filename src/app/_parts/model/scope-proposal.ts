/**
 * @file 1スコープ分の表示材料（書式化前の本文・理由行・再測定）と、それを画面の書式へ整えた
 *   diff提案の表示モデルを組み立てる。
 */
import { readFileSync } from 'node:fs'
import { scopeSourcePath, type ReportConfig } from '@/lib/config/report-config'
import { sha256String } from '@/lib/data/json-io'
import { diffDataPath, loadDiffData, type DiffData, type DiffEdit } from '@/lib/data/report-data'
import { renderDiffRowList, type DiffReason } from '@/lib/diff'
import { readerCopy, validateCopy } from '@/lib/revision/reader-copy'
import { REVISION_VERSION } from '@/lib/revision/types'
import { visible } from '@/lib/text/anonymize'
import { chapterSource } from '@/lib/text/chapter-source'
import { formatFixed, formatGeneral } from '../format'
import type { DiffBoxModel, MetricListGroup, MetricValue, ScopeProposalModel } from './types'

/** 指標pathの先頭要素 → 変更案の理由行・再測定テーブルで使う観点名。 */
const GENRE: Record<string, string> = {
  lsmCategory: 'LSM',
  paragraph: '文・段落の長さ',
  sentence: '文・段落の長さ',
  politeness: '敬語の密度',
  sentenceEnding: '文末表現',
}

/** 再測定テーブルの観点の並び順。 */
const GENRE_ORDER = ['LSM', '文末表現', '敬語の密度', '文・段落の長さ']
/** 再測定テーブルの見出しで観点名を言い換える場合。 */
const GENRE_HEADING: Record<string, string> = { LSM: 'LSM 類似度' }

/**
 * 再測定テーブルの値の書式。百分率は小数3桁固定、それ以外は一般表記。
 *
 * @param value 値。
 * @param unit 単位。
 * @returns 書式化済みの値と単位。
 */
function metricValue(value: number, unit: string): MetricValue {
  return { value: unit === '%' ? formatFixed(value, 3) : formatGeneral(value), unit }
}

/**
 * 再測定テーブルの行を観点ごとにまとめる。値が動かなかった指標と対象外の指標は出さない。
 *
 * @param material 表示材料。
 * @returns 観点ごとの行。
 * @throws 表に出す指標の観点が未知なら止める。
 */
function metricListGroupList(material: ScopeReportMaterial): MetricListGroup[] {
  const groupList: MetricListGroup[] = []
  for (const metric of material.metricList) {
    if (!metric.target || Math.abs(metric.after - metric.before) <= 1e-12) continue
    const genre = metric.genre
    if (!genre)
      throw new Error(`report/${material.section}: unknown metric group for '${metric.item}'`)
    const entry = {
      item: metric.item,
      before: metricValue(metric.before, metric.unit),
      after: metricValue(metric.after, metric.unit),
      model: metricValue(metric.model, metric.unit),
      direction: (metric.after > metric.before
        ? 'plus'
        : metric.after < metric.before
          ? 'minus'
          : '') as 'plus' | 'minus' | '',
    }
    const last = groupList[groupList.length - 1]
    if (last && last.genre === genre) last.entryList.push(entry)
    else {
      groupList.push({
        genre,
        badge: GENRE_ORDER.indexOf(genre) + 1,
        heading: GENRE_HEADING[genre] ?? genre,
        entryList: [entry],
      })
    }
  }
  return groupList
}

/**
 * 保存済みの変更案をスコープ本文へ適用し、その過程で記録済みの2つのハッシュを検証する。revisionワークフロー
 * 側の`applyEdits`も同じ処理を行うが、そちらは範囲・重なりの検証を持ち、こちらはハッシュ検証を持つという
 * 差分がある別実装で、画面の表示モデル組み立てからは計測スタックの奥にある`applyEdits`を読む理由が無い。
 *
 * @param data 公開済みデータ。
 * @param original スコープ本文。
 * @param path エラー文言に出すファイルパス。
 * @returns 改稿。
 * @throws 変更案の`before`が本文と一致しない、または原文・改稿のハッシュが公開済みデータと一致しなければ止める。
 */
function revisedText(data: DiffData, original: string, path: string): string {
  if (sha256String(original) !== data.originalTextSha256) {
    throw new Error(`${path}: originalTextSha256 does not match the manuscript slice`)
  }
  let revised = original
  for (const edit of [...data.editList].sort((a, b) => b.start - a.start)) {
    if (revised.slice(edit.start, edit.end) !== edit.before) {
      throw new Error(
        `${path}: edit ${edit.id} does not match the text at [${edit.start}, ${edit.end})`
      )
    }
    revised = revised.slice(0, edit.start) + edit.after + revised.slice(edit.end)
  }
  if (sha256String(revised) !== data.revisedTextSha256) {
    throw new Error(`${path}: revisedTextSha256 does not match the applied edits`)
  }
  return revised
}

/**
 * 理由行の見出し。方向語（増やす・減らす等）は候補単独で適用したときの計測値`isolated`（お手本・適用前・適用後）から決め、無ければ付けない（revision-workflow.md「diff_dataN.json」）。
 *
 * @param edit 公開済みの変更案1件。
 * @param path エラー文言に出すファイルパス。
 * @returns 見出し。
 * @throws 指標pathの群が未知なら止める。
 */
function reasonTitle(edit: DiffEdit, path: string): string {
  const genre = GENRE[edit.metricPath.split('.')[0]]
  if (!genre) throw new Error(`${path}: unknown metric group for '${edit.metricPath}'`)
  let action = ''
  if (edit.isolated) {
    const { before, after } = edit.isolated
    if (after === before) action = '値を維持'
    else if (['sentence', 'paragraph'].includes(edit.metricPath.split('.')[0])) {
      action = after < before ? '短くする' : '長くする'
    } else action = after < before ? '減らす' : '増やす'
  }
  return `${genre} - ${edit.label}を${action}調整`
}

/**
 * 再測定の1行（書式化前）。`genre`は再測定テーブルの観点で、`GENRE`に載らない指標（`lsm.mean`）では空。
 */
export interface ScopeMetricMaterial {
  genre: string
  item: string
  unit: string
  model: number
  before: number
  after: number
  target: boolean
}

/** 理由行1件（書式化前）。`line`はスコープ本文の何行目か（0始まり）。 */
export interface ScopeReasonMaterial {
  id: string
  line: number
  title: string
  reason: string
  tradeoff: string
}

/**
 * 1スコープ分の表示材料（書式化前）。数値は数値のまま、本文は行に分ける前の全体で持つ。
 * 画面の表示モデルも公開環境へ送る内容も、この値から組み立てる。
 */
export interface ScopeReportMaterial {
  /** スコープid。個別スコープの引き当てにだけ使い、指標の観点判定には使わない。 */
  section: number
  /** 変更前の本文（`visible`でマスク済み）。 */
  beforeText: string
  /** 変更案を当てた本文（同上）。 */
  afterText: string
  reasonList: ScopeReasonMaterial[]
  /** 再測定の全指標。表示用の絞り込み（対象・値の動き）はしない。 */
  metricList: ScopeMetricMaterial[]
  lsmBefore: number
  lsmAfter: number
}

/**
 * 1スコープ分の表示材料。公開済みデータの版と2つのハッシュを検証し、本文にマスクを、説明文に読者向けの
 * 整形（`readerCopy`・`validateCopy`）を施したうえで、書式化していない値を返す。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 表示材料。`revisionStatus`が`complete`でなければnull。
 * @throws 公開データのversionが未対応、原文・改稿のハッシュが本文と一致しない、説明文に不備がある、
 *   または`lsm.mean`行が無ければ止める。
 */
export function scopeReportMaterial(
  config: ReportConfig,
  scope: number
): ScopeReportMaterial | null {
  const path = diffDataPath(config, scope)
  const data = loadDiffData(config, scope)
  if (data.version !== REVISION_VERSION) {
    throw new Error(`${path}: unsupported version '${data.version}'`)
  }
  if (data.revisionStatus !== 'complete') return null

  const original = chapterSource(readFileSync(scopeSourcePath(config, scope), 'utf-8')).text
  const revised = revisedText(data, original, path)

  const displayed = data.editList.map(edit =>
    readerCopy({ ...edit } as unknown as Record<string, unknown>)
  )
  validateCopy(displayed, `diff_data${scope}.json`)

  const lsm = data.metricList.find(metric => metric.path === 'lsm.mean')
  if (!lsm) throw new Error(`${path}: missing metric 'lsm.mean'`)

  return {
    section: data.section,
    beforeText: visible(original, config.anonymization.edited),
    afterText: visible(revised, config.anonymization.edited),
    reasonList: data.editList.map((edit, index) => ({
      id: edit.id,
      line: original.slice(0, edit.start).split('\n').length - 1,
      title: reasonTitle(edit, path),
      reason: String(displayed[index].displayReason),
      tradeoff: String(displayed[index].tradeoff),
    })),
    metricList: data.metricList.map(metric => ({
      genre: GENRE[metric.path.split('.')[0]] ?? '',
      item: metric.label.split('・').slice(1).join('・') || metric.label,
      unit: metric.unit,
      model: metric.model,
      before: metric.before,
      after: metric.after,
      target: metric.target === true,
    })),
    lsmBefore: lsm.before,
    lsmAfter: lsm.after,
  }
}

/**
 * 1スコープ分のdiff提案の表示モデル。表示材料を画面の書式へ整える。材料の取得元（microCMS・
 * ファイル）はこの関数の外で決める。
 *
 * @param material 表示材料。スコープidは`material.section`が持つ。
 * @param label スコープの表示名。
 * @param modelLabel お手本媒体の表示名。
 * @returns 表示モデル。材料がnull（変更案が未完了）ならnull。
 * @throws 表に出す指標の観点が未知なら止める。
 */
export function scopeProposal(
  material: ScopeReportMaterial | null,
  label: string,
  modelLabel: string
): ScopeProposalModel | null {
  if (material === null) return null
  const scope = material.section

  const reasonList: DiffReason[] = material.reasonList.map(entry => ({
    line: entry.line,
    row: {
      kind: 'reason',
      id: `reason-${scope}-${entry.id}`,
      title: entry.title,
      reason: entry.reason,
      tradeoff: entry.tradeoff,
    },
  }))

  const diff: DiffBoxModel = {
    scope,
    title: label,
    rowList: renderDiffRowList(
      material.beforeText.split('\n'),
      material.afterText.split('\n'),
      reasonList
    ),
  }

  return {
    kind: 'scope',
    lead: material.metricList.some(metric => metric.target)
      ? '値が離れている指標で、ちがいを緩和する提案です。'
      : '今回の調整対象はありません。',
    lsm: { before: formatFixed(material.lsmBefore, 3), after: formatFixed(material.lsmAfter, 3) },
    metricList: metricListGroupList(material),
    metricListHeaderList: ['既存テキスト', '調整提案', `参考とする${modelLabel}の指標`],
    diff,
  }
}
