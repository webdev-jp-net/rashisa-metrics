import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sha256String } from '../data/json-io'
import { readJson } from '../data/json-io'
import { candidatesPath, evaluationPath, loadPlan } from '../data/propose'
import { budget } from './budget'
import { sourceHashList } from './hashes'
import { deepEqual, ensure, saveJson } from './io'
import { chapterText, measureChapter, type RevisionContext } from './measure'
import { getValue } from './metric-specs'
import {
  EPS,
  REVISION_VERSION,
  type CandidatesFile,
  type ChapterMeasurement,
  type EvaluationPayload,
  type MetricSpec,
  type Problem,
  type Residual,
  type RevisionCandidate,
  type RevisionPlan,
} from './types'

/** 候補が本文中の数値（事実）を変えていないことを検査するための数字列。 */
const NUMBERS = /[0-9０-９]+(?:[.．][0-9０-９]+)?/g

/** 候補が削除・変更してはならない既存の引用（「」『』）。 */
const QUOTES = /「[^「」]*」|『[^『』]*』/g

/**
 * 文字列の出現数。引用の増減検査で、同じ引用が複数回ある本文にも対応するため。
 *
 * @param valueList 数える文字列。
 * @returns 文字列 → 出現数。
 */
function countBy(valueList: string[]): Map<string, number> {
  const counter = new Map<string, number>()
  for (const value of valueList) counter.set(value, (counter.get(value) ?? 0) + 1)
  return counter
}

/**
 * 候補の適用順。位置が同じ候補はidで決めて、候補ファイル内の並び順に依存しないようにする。
 *
 * @param a 候補。
 * @param b 候補。
 * @returns `Array.prototype.sort`用の比較値。
 */
function byOffset(a: RevisionCandidate, b: RevisionCandidate): number {
  if (a.start !== b.start) return a.start - b.start
  if (a.end !== b.end) return a.end - b.end
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * 候補をスコープ本文に適用した改稿を返す。候補の位置は`before`の文字列検索ではなくオフセットで決める
 * （同じ語句が複数あっても取り違えないため）。後ろから順にspliceして前方のオフセットを保つ。
 *
 * @param original スコープ本文。
 * @param editList 適用する候補。
 * @returns 改稿。
 * @throws 範囲が不正・重なる・`before`が本文と一致しない候補があれば止める。
 */
export function applyEdits(original: string, editList: RevisionCandidate[]): string {
  const ordered = [...editList].sort(byOffset)
  let last = 0
  for (const edit of ordered) {
    ensure(
      0 <= edit.start && edit.start < edit.end && edit.end <= original.length,
      `Invalid edit range: ${edit.id}`
    )
    ensure(edit.start >= last, 'Overlapping candidates')
    ensure(
      original.slice(edit.start, edit.end) === edit.before,
      `Original fragment mismatch: ${edit.id}`
    )
    last = edit.end
  }
  let result = original
  for (const edit of [...ordered].reverse()) {
    result = result.slice(0, edit.start) + edit.after + result.slice(edit.end)
  }
  return result
}

/**
 * 実例集（`exemplar_bank.jsonl`）のid一覧。候補の`modelRefList`が実在する実例を指しているかの検査に使う。
 *
 * @param root リポジトリルート。
 * @param relativePath 計画の`modelExamples`（実例集の相対パス）。
 * @returns idの集合。
 */
export function loadExemplarIdList(root: string, relativePath: string): Set<string> {
  const text = readFileSync(resolve(root, relativePath), 'utf-8')
  const idList = new Set<string>()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const record = JSON.parse(line) as { id?: string }
    if (record.id !== undefined) idList.add(record.id)
  }
  return idList
}

/**
 * 候補ファイルの形式と規則（revision-workflow.md）を検査する。機械的に検査できることだけを見る。
 * 文章の自然さは判定しない（それは公開前の全文レビューの役割）。
 *
 * @param plan 計画のうちtargetのid。
 * @param review 候補ファイルの内容。
 * @param original スコープ本文。
 * @param exemplarIdList 実例集のid。
 * @returns 検査を通った候補。
 * @throws 候補・targetごとの結論・bundle（同時に採用する候補idの組）のいずれかが規則に反すれば止める。
 */
export function validateReview(
  plan: { targetList: { id: string }[] },
  review: CandidatesFile,
  original: string,
  exemplarIdList: Set<string>
): RevisionCandidate[] {
  const targetList = new Set(plan.targetList.map(spec => spec.id))
  const candidateList = review.candidateList ?? []
  ensure(
    new Set(candidateList.map(c => c.id)).size === candidateList.length,
    'Duplicate candidate IDs'
  )
  const idList = new Set(candidateList.map(c => c.id))

  const originalQuoteList = countBy([...original.matchAll(QUOTES)].map(m => m[0]))

  for (const candidate of candidateList) {
    ensure(
      candidate.targetList !== undefined &&
        candidate.targetList.length > 0 &&
        candidate.targetList.every(target => targetList.has(target)),
      `Candidate must address a standout target: ${candidate.id}`
    )
    ensure(
      candidate.before !== candidate.after &&
        (candidate.after === '' || candidate.after.trim() !== ''),
      'Empty or unchanged candidate'
    )
    applyEdits(original, [candidate])
    ensure(
      deepEqual(
        [...candidate.before.matchAll(NUMBERS)].map(m => m[0]),
        [...candidate.after.matchAll(NUMBERS)].map(m => m[0])
      ),
      `Candidate changed a factual number: ${candidate.id}`
    )
    const newQuoteList = countBy(
      [...applyEdits(original, [candidate]).matchAll(QUOTES)].map(m => m[0])
    )
    for (const [quote, count] of originalQuoteList) {
      ensure(
        (newQuoteList.get(quote) ?? 0) >= count,
        `Candidate changed an existing quotation: ${candidate.id}`
      )
    }
    ensure(
      Boolean(candidate.displayReason) && Boolean(candidate.tradeoff),
      'Candidate reason and meaning/voice effect required'
    )
    ensure(
      candidate.modelRefList !== undefined &&
        candidate.modelRefList.length > 0 &&
        candidate.modelRefList.every(ref => exemplarIdList.has(ref)),
      'Use existing model-media exemplar IDs'
    )
  }

  const conclusionList = review.targetReviewList ?? []
  ensure(
    conclusionList.length === targetList.size &&
      new Set(conclusionList.map(x => x.target)).size === targetList.size &&
      conclusionList.every(x => targetList.has(x.target)),
    'Each target needs a whole-chapter conclusion'
  )
  ensure(
    conclusionList.every(x => (x.reason ?? '').trim() !== ''),
    'Target conclusions require reasons'
  )
  for (const bundle of review.bundleList ?? []) {
    ensure(
      bundle.length >= 2 &&
        new Set(bundle).size === bundle.length &&
        bundle.every(id => idList.has(id)),
      'Invalid candidate bundle'
    )
  }
  return candidateList
}

/**
 * 改稿前後の計測値の数値チェック。基準超過targetはお手本媒体の値を飛び越えて行き過ぎてはならず
 * （`overshoot`）、お手本媒体の値から遠ざかってもならない（`targetRegression`）。target以外の
 * 指標が新たに基準を超えてはならず（`newStandout`）、少なくとも1つのtargetは改善していなければ
 * ならない。
 *
 * `protectedTargetList`は、基準超過チェックの対象を適用済み候補が宣言したtargetだけに絞る —
 * それ以外の基準超過指標は副作用としてのブレを許容する。
 *
 * @param specList 26指標の仕様。
 * @param current 改稿前の計測結果。
 * @param proposed 改稿後の計測結果。
 * @param protectedTargetList 基準超過チェックの対象に絞るtargetのid。省略時は全target。
 * @returns 問題の一覧と、改善したtargetのid。
 */
export function violations(
  specList: MetricSpec[],
  current: unknown,
  proposed: unknown,
  protectedTargetList?: Iterable<string>
): { problemList: Problem[]; improved: string[] } {
  const problemList: Problem[] = []
  const improved: string[] = []
  const protectedIdList = protectedTargetList === undefined ? null : new Set(protectedTargetList)

  for (const spec of specList) {
    const a = getValue(current, spec)
    const b = getValue(proposed, spec)
    const n = spec.model
    const da = Math.abs(a - n)
    const db = Math.abs(b - n)
    if (spec.standout) {
      if (protectedIdList === null || protectedIdList.has(spec.id)) {
        if ((a > n + EPS && b < n - EPS) || (a < n - EPS && b > n + EPS)) {
          problemList.push({ target: spec.id, reason: 'overshoot' })
        }
        if (db > da + EPS) problemList.push({ target: spec.id, reason: 'targetRegression' })
        if (db < da - EPS) improved.push(spec.id)
      }
    } else if (spec.limit !== null && db > spec.limit + EPS) {
      problemList.push({ target: spec.id, reason: 'newStandout' })
    }
  }
  if (improved.length === 0) problemList.push({ target: null, reason: 'noImprovement' })
  return { problemList: problemList, improved }
}

/** 検証済みの計画と、その時点のスコープ本文。 */
export interface CurrentPlanResult {
  plan: RevisionPlan
  original: string
}

/**
 * 保存済みのplanを読み込み、planの元になった入力かスコープ本文自体がその後変わっていた場合は処理を拒否する。
 *
 * @param ctx 設定と解析器。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 計画とスコープ本文。
 * @throws 計画の版・スコープid・入力ハッシュ・本文のいずれかが合わなければ止める。
 */
export function currentPlan(ctx: RevisionContext, scope: number): CurrentPlanResult {
  const plan = loadPlan(ctx.config, scope) as unknown as RevisionPlan
  ensure(plan.version === REVISION_VERSION && plan.section === scope, 'Invalid revision plan')
  ensure(
    deepEqual(plan.sourceHashList, sourceHashList(ctx.config, scope)),
    'Revision inputs changed; prepare and review candidates again'
  )
  const { text } = chapterText(ctx.config, scope)
  ensure(sha256String(text) === plan.originalSha256, 'Chapter text changed')
  return { plan, original: text }
}

/** `measure`を注入するのは、テストで解析器なしに評価ロジックを検証するため。 */
export interface EvaluateInput {
  plan: { targetList: MetricSpec[]; metricList: MetricSpec[]; section: number }
  original: string
  review: CandidatesFile
  exemplarIdList: Set<string>
  measure: (text: string) => ChapterMeasurement
}

/**
 * 評価の本体。レビュー済みの候補を一括で適用し、原文と改稿をそれぞれ1回ずつ計測する。候補は取り除かず、
 * 不合格のチェックは`problemList`に記録してagentに解決させる。
 *
 * @param input 計画・本文・候補・実例集のidと、計測関数。
 * @returns `evaluationN.json`に保存する内容。
 */
export function evaluateCandidates(input: EvaluateInput): EvaluationPayload {
  const { plan, original, review, exemplarIdList, measure } = input
  const candidateList = validateReview(plan, review, original, exemplarIdList)
  const revised = applyEdits(original, candidateList)
  const baseline = measure(original)
  const final = candidateList.length > 0 ? measure(revised) : baseline

  const selected = [...candidateList].sort(byOffset).map(candidate => candidate.id)
  const addressed = new Set(candidateList.flatMap(candidate => candidate.targetList ?? []))

  let problemList: Problem[] = []
  let improved: string[] = []
  if (candidateList.length > 0) {
    const result = violations(plan.metricList, baseline.profile, final.profile, addressed)
    problemList = result.problemList
    improved = result.improved
  }

  const improvedTargetList = improved.filter(target => addressed.has(target))
  if (candidateList.length > 0 && improvedTargetList.length === 0) {
    problemList.push({ target: null, reason: 'declaredTargetNotImproved' })
  }
  for (const target of improvedTargetList) {
    if (!(target in final.countList)) continue
    const a = baseline.countList[target]!.numerator
    const b = final.countList[target]!.numerator
    const spec = plan.metricList.find(metric => metric.id === target)!
    // 比率が改善しても分子が同じか逆方向なら、分母だけの変化による見かけの改善なので採用しない
    if ((b - a) * (spec.model - getValue(baseline.profile, spec)) <= 0) {
      problemList.push({ target, reason: 'denominatorOnly' })
    }
  }

  const reviewList = review.targetReviewList ?? []
  const residualList: Residual[] = plan.targetList.map(spec => ({
    id: spec.id,
    status:
      Math.abs(getValue(final.profile, spec) - spec.model) < EPS ? 'reached' : 'preserveExpression',
    ...budget(spec, final),
    reason: reviewList.find(entry => entry.target === spec.id)!.reason,
  }))

  return {
    version: REVISION_VERSION,
    section: plan.section,
    selected,
    problemList,
    stepList: selected.length > 0 ? [{ added: selected, improved }] : [],
    residualList,
    revisedSha256: sha256String(revised),
    revisedText: revised,
    measurementList: { before: baseline.profile, after: final.profile },
    search: 'batch: apply all reviewed candidates and measure once',
  }
}

/**
 * evaluate段階の入口。計画・候補・実例集を読み、評価して`evaluationN.json`に保存する。
 *
 * @param ctx 設定と解析器。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @param write falseなら保存しない。
 * @returns 評価結果。
 */
export function evaluate(ctx: RevisionContext, scope: number, write = true): EvaluationPayload {
  const { plan, original } = currentPlan(ctx, scope)
  const review = readJson<CandidatesFile>(candidatesPath(ctx.config, scope))
  const payload = evaluateCandidates({
    plan,
    original,
    review,
    exemplarIdList: loadExemplarIdList(ctx.config.root, plan.modelExamples),
    measure: text => measureChapter(text, ctx),
  })
  if (write) saveJson(evaluationPath(ctx.config, scope), payload)
  return payload
}
