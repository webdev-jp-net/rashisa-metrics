import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readJson, sha256String } from '../data/json-io'
import { loadModelProfile } from '../data/profiles'
import { candidatesPath, evaluationPath } from '../data/propose'
import { diffDataPath } from '../data/report-data'
import type { StylometricProfile } from '../data/types'
import { lsmPairwiseMean } from '../metrics/lsm'
import { applyEdits, currentPlan, evaluate } from './evaluate'
import { deepEqual, ensure, saveJson } from './io'
import type { RevisionContext } from './measure'
import { getValue } from './metric-specs'
import {
  EPS,
  REVISION_VERSION,
  type CandidatesFile,
  type EvaluationPayload,
  type MetricSpec,
  type PublishedDiffData,
  type PublishedEdit,
  type PublishedMetric,
  type RevisionCandidate,
  type RevisionPlan,
} from './types'

/**
 * 公開データの`lsm.mean`行の値。お手本との平均LSMを、改稿前後それぞれの計測結果から求める。
 *
 * @param model お手本媒体のプロファイル本体。
 * @param profile 計測結果（`lsmCategory.ratioList`を持つ）。
 * @returns 平均LSM。
 */
export function lsmMean(model: StylometricProfile, profile: unknown): number {
  const a = model.lsmCategory.ratioList as unknown as Record<string, number>
  const b = (profile as { lsmCategory: { ratioList: Record<string, number> } }).lsmCategory
    .ratioList
  return lsmPairwiseMean(a, b, Object.keys(a))
}

/**
 * 保存済みの評価（`evaluationN.json`）が現在の候補・承認記録と一致していればそれを使う。publishで
 * 再計測せずに済ませるため。承認済みテキスト・保存済みの選択・ディスク上の候補が、なお同じテキストを
 * 再現する場合に限る。
 *
 * @param original スコープ本文。
 * @param review 候補ファイルの内容。
 * @param cached 保存済みの評価。無ければnull。
 * @returns 再利用できなければnull（古いとみなす）。
 */
export function selectCachedEvaluation(
  original: string,
  review: CandidatesFile,
  cached: EvaluationPayload | null
): EvaluationPayload | null {
  const finalReview = review.finalReview ?? {}
  if (finalReview.verdict !== 'approved' || cached === null) return null
  const byId = new Map((review.candidateList ?? []).map(candidate => [candidate.id, candidate]))
  const selected = cached.selected ?? []
  if (finalReview.revisedSha256 !== cached.revisedSha256) return null
  if (!selected.every(id => byId.has(id))) return null
  let revised: string
  try {
    revised = applyEdits(
      original,
      selected.map(id => byId.get(id)!)
    )
  } catch {
    return null
  }
  return sha256String(revised) === cached.revisedSha256 ? cached : null
}

/** `buildPublishData`の入力。`plan`は公開データに写す項目だけ。 */
export interface BuildPublishDataInput {
  plan: Pick<
    RevisionPlan,
    'metricList' | 'sourceLineList' | 'label' | 'sourceFile' | 'sourceHashList'
  >
  original: string
  review: CandidatesFile
  result: EvaluationPayload
  model: StylometricProfile
  scope: number
}

/**
 * `diff_dataN.json`の内容を組み立てる。編集は本文順に並べ、各指標の改稿前後とお手本との差の動き（縮小・拡大・同じ）を付ける。
 *
 * @param input 計画・本文・候補・評価結果・お手本プロファイル・スコープid。
 * @returns ファイル内容。
 * @throws 候補のtargetが26指標に無ければ止める。
 */
export function buildPublishData(input: BuildPublishDataInput): PublishedDiffData {
  const { plan, original, review, result, model, scope } = input
  const byId = new Map((review.candidateList ?? []).map(candidate => [candidate.id, candidate]))
  const specList = plan.metricList
  const before = result.measurementList.before
  const after = result.measurementList.after

  const ordered: RevisionCandidate[] = result.selected.map(id => byId.get(id)!)
  ordered.sort((a, b) => a.start - b.start)

  const editList: PublishedEdit[] = ordered.map(candidate => {
    const spec = specList.find(entry => entry.id === candidate.targetList?.[0])
    ensure(spec !== undefined, `Candidate target is not a known metric: ${candidate.id}`)
    // 候補はスコープ本文内のオフセットしか持たないので、開始位置までの改行数で行indexを求め、スコープの原資料ファイル内の行番号へ写す
    const newlines = original.slice(0, candidate.start).split('\n').length - 1
    const edit: PublishedEdit = { ...candidate }
    edit.target = spec.id
    edit.metricPath = spec.id
    edit.label = spec.label
    edit.sourceLine = plan.sourceLineList[newlines]
    return edit
  })

  const metricList: PublishedMetric[] = specList.map((spec: MetricSpec) => {
    const b = getValue(before, spec)
    const a = getValue(after, spec)
    const movement =
      Math.abs(a - spec.model) < Math.abs(b - spec.model) - EPS
        ? '縮小'
        : Math.abs(a - spec.model) > Math.abs(b - spec.model) + EPS
          ? '拡大'
          : '同じ'
    return {
      path: spec.id,
      label: spec.label,
      unit: spec.unit,
      model: spec.model,
      before: b,
      after: a,
      target: spec.standout,
      movement,
    }
  })
  metricList.push({
    path: 'lsm.mean',
    label: '平均LSM',
    unit: '',
    model: 1,
    before: lsmMean(model, before),
    after: lsmMean(model, after),
    target: false,
  })

  return {
    version: REVISION_VERSION,
    revisionStatus: 'complete',
    section: scope,
    label: plan.label,
    sourceFile: plan.sourceFile,
    sourceHashList: plan.sourceHashList,
    originalTextSha256: sha256String(original),
    revisedTextSha256: result.revisedSha256,
    editList,
    metricList,
    measurementList: result.measurementList,
    residualList: result.residualList,
    finalReview: review.finalReview ?? {},
  }
}

/** `check`は書き込まずに照合だけしたことを示す。 */
export interface PublishResult {
  data: PublishedDiffData
  path: string
  check: boolean
}

/**
 * publish段階の入口。評価が最新で問題が無く、全文レビューが承認済みのときだけ`diff_dataN.json`を書く。
 *
 * @param ctx 設定と解析器。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @param check trueなら何も書き込まず、生成結果が公開済みファイルと一致することだけを確認する（CLIの`--check`）。
 * @returns 公開データとそのパス。
 * @throws 評価が古い・問題が残る・承認記録が無い場合は止める。`check`で不一致なら止める。
 */
export function publish(ctx: RevisionContext, scope: number, check = false): PublishResult {
  const { config } = ctx
  const { plan, original } = currentPlan(ctx, scope)
  const review = readJson<CandidatesFile>(candidatesPath(config, scope))
  const finalReview = review.finalReview ?? {}

  const cachedPath = evaluationPath(config, scope)
  const cached = existsSync(cachedPath) ? readJson<EvaluationPayload>(cachedPath) : null
  let result = selectCachedEvaluation(original, review, cached)

  if (result === null) {
    ensure(
      !check,
      '保存済み評価が現在の改稿文と一致しません。evaluateと全文レビューを完了してください。'
    )
    result = evaluate(ctx, scope, !check)
  }
  ensure(
    (result.problemList ?? []).length === 0,
    'まとめて適用した結果に確認事項があります。evaluationのproblemListを確認してください: ' +
      JSON.stringify(result.problemList)
  )
  ensure(
    finalReview.revisedSha256 === result.revisedSha256 &&
      finalReview.verdict === 'approved' &&
      Boolean(finalReview.reason),
    'Read the current revised chapter and record finalReview before publishing'
  )

  const model = loadModelProfile(config).stylometricProfile
  const data = buildPublishData({ plan, original, review, result, model, scope })
  const destination = diffDataPath(config, scope)
  if (check) {
    ensure(
      deepEqual(readJson<unknown>(destination), data),
      'Published revision differs; regenerate it'
    )
  } else {
    saveJson(destination, data)
    // スコープ0の複製はrevision-workflow.mdの仕様で出力している。読み込む処理は無い
    if (scope === 0) saveJson(join(config.pathList.report, 'preface_diff_data.json'), data)
  }
  return { data, path: destination, check }
}
