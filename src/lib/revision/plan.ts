import { join, relative } from 'node:path'
import { scopeLabel, scopeSourcePath } from '../config/report-config'
import { sha256File, sha256String } from '../data/json-io'
import { loadChapterProfile, loadModelProfile } from '../data/profiles'
import { planPath } from '../data/propose'
import { loadOverviewCriteria } from '../data/report-data'
import { budget } from './budget'
import { sourceHashList } from './hashes'
import { ensure, saveJson } from './io'
import { baselineCheck, chapterText, measureChapter, type RevisionContext } from './measure'
import { getValue, metricSpecList } from './metric-specs'
import { REVISION_VERSION, type MetricSpec, type PlanBlock, type RevisionPlan } from './types'

/** 計画に書き込むagent向けの指示文。 */
const INSTRUCTIONS =
  'Read every block against every target; generate zero or multiple local candidates per target. ' +
  'Preserve facts, quotations and meaning. See _llm-docs/analysis/revision-workflow.md.'

/**
 * スコープ本文を空行区切りのブロック（agentが候補を探す単位）に分け、本文内のオフセットを付ける。
 *
 * @param text スコープ本文。
 * @returns ブロック。idは`p001`からの連番。
 */
export function blockListOf(text: string): PlanBlock[] {
  const blockList: PlanBlock[] = []
  const pattern = /\S(?:[\s\S]*?\S)?(?=\n[ \t]*\n|$)/g
  let index = 1
  for (const match of text.matchAll(pattern)) {
    const start = match.index
    blockList.push({
      id: `p${String(index).padStart(3, '0')}`,
      start,
      end: start + match[0].length,
      text: match[0],
    })
    index += 1
  }
  return blockList
}

/**
 * agentが差の大きいtargetから取り組めるよう、お手本との差を強調の閾値`limit`で正規化した距離の降順に並べる。
 *
 * @param specList 26指標の仕様。
 * @returns 基準超過の指標だけを、取り組む順に。
 */
export function orderTargetList(specList: MetricSpec[]): MetricSpec[] {
  return specList
    .filter(spec => spec.standout)
    .sort((a, b) => {
      const keyA = -Math.abs(a.before - a.model) / (a.limit ?? 1)
      const keyB = -Math.abs(b.before - b.model) / (b.limit ?? 1)
      if (keyA !== keyB) return keyA - keyB
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
}

/** 保存した計画とそのパス。 */
export interface PrepareResult {
  plan: RevisionPlan
  path: string
}

/**
 * prepare段階の入口。スコープ本文を再計測し、保存済みプロファイル・比較データ・一覧の根拠データと
 * 一致することを確かめてから`planN.json`を書く。`comparison_data*.json`・`overview_criteria.json`の
 * 再生成はここでは行わない（`scripts/build-report.ts`の別工程）。代わりに鮮度チェックで、古い入力から
 * planが作られることを拒否する。
 *
 * @param ctx 設定と解析器。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @param write falseなら保存しない。
 * @returns 計画とそのパス。
 * @throws 保存済みデータとの不一致があれば止める。
 */
export function prepare(ctx: RevisionContext, scope: number, write = true): PrepareResult {
  const { config } = ctx
  const saved = loadChapterProfile(config, scope).stylometricProfile
  const sourceFileList = saved.meta.sourceFileList
  ensure(
    sourceFileList !== undefined && sourceFileList.length === 1,
    'Chapter profile must be measured from exactly one source file'
  )
  ensure(
    sourceFileList[0]!.sha256 === sha256File(scopeSourcePath(config, scope)),
    'Refresh chapter extraction before preparing revisions'
  )
  const { text, lineList } = chapterText(config, scope)
  const details = measureChapter(text, ctx)
  baselineCheck(details.profile, saved)

  const model = loadModelProfile(config).stylometricProfile
  ensure(
    details.profile.measurement.tokenizer === model.meta.measurement.tokenizer,
    'Model-media tokenizer differs'
  )
  ensure(
    details.profile.measurement.lsmClassificationRule ===
      model.meta.measurement.lsmClassificationRule,
    'お手本媒体と章のLSM判定定義が異なります。同じ定義で両方を再計測してください。'
  )

  const overview = loadOverviewCriteria(config)
  for (const source of overview.sourceList) {
    ensure(
      sha256File(join(config.pathList.report, source.comparisonFile)) === source.sha256,
      'Stale comparison evidence'
    )
  }

  const scopeIdList = [...config.scopeList].sort((a, b) => a.id - b.id).map(entry => entry.id)
  const specList = metricSpecList(overview, scope, scopeIdList)
  for (const spec of specList) {
    ensure(
      Math.abs(getValue(details.profile, spec) - spec.before) < 1e-8,
      `Comparison baseline differs: ${spec.id}`
    )
  }

  const entry = config.scopeList.find(candidate => candidate.id === scope)
  ensure(entry !== undefined, `Unknown scope: ${scope}`)

  const plan: RevisionPlan = {
    version: REVISION_VERSION,
    section: scope,
    label: scopeLabel(scope),
    sourceHashList: sourceHashList(config, scope),
    sourceFile: entry.file,
    sourceLineList: lineList,
    originalSha256: sha256String(text),
    blockList: blockListOf(text),
    metricList: specList,
    targetList: orderTargetList(specList).map(spec => ({
      ...spec,
      budget: budget(spec, details),
    })),
    countList: details.countList,
    modelExamples: relative(config.root, join(config.pathList.modelProfile, 'exemplar_bank.jsonl')),
    instructions: INSTRUCTIONS,
  }

  const path = planPath(config, scope)
  if (write) saveJson(path, plan)
  return { plan, path }
}
