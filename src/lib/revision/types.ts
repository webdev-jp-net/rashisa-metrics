import type { MeasurementResult as MetricsMeasurementResult } from '../metrics/types'

/** plan・evaluation・公開データの形式版。変えると既存データは`currentPlan`で拒否され、全スコープの再生成が必要になる。 */
export const REVISION_VERSION = 'chapter-revision-4'

/** 「値がお手本媒体により近づいたか」を判定する際に使う許容誤差。 */
export const EPS = 1e-10

/** ディスク上の同じ形は`src/lib/data/propose.ts`の`PlanMetric`。こちらは計算途中の形で、limitを持たない列があるため`limit`がnullになりうる。 */
export interface MetricSpec {
  id: string
  path: string
  label: string
  group: string
  unit: string
  scale: number
  model: number
  before: number
  limit: number | null
  standout: boolean
}

/** 1つのtargetに対する探索の目安: スコープがお手本媒体からどれだけ、どの方向に離れているか。 */
export interface Budget {
  current: number
  model: number
  gap: number
  direction: 'increase' | 'decrease' | 'none'
  /** 分布系の指標（文・段落長）は分子を持たないためnull。 */
  estimatedDeltaCount: number | null
  targetCountAtCurrentDenominator: number | null
  numerator: number | null
  denominator: number | null
}

/** 基準超過の指標（agentが取り組む対象）。探索の目安付き。 */
export interface MetricTarget extends MetricSpec {
  budget: Budget
}

/** agentが候補を探す単位。`start`/`end`はスコープ本文内のオフセット。 */
export interface PlanBlock {
  id: string
  start: number
  end: number
  text: string
}

/** スコープ本文の計測結果と、指標ごとの分子・分母・出現根拠。 */
export interface ChapterMeasurement {
  profile: MetricsMeasurementResult
  countList: Record<string, { numerator: number; denominator: number; occurrenceList: unknown[] }>
}

/** `planN.json`の形（revision-workflow.md「planN.json」）。 */
export interface RevisionPlan {
  version: string
  section: number
  label: string
  sourceHashList: Record<string, string>
  /** スコープの原資料ファイル名（`pathList.editedSource`からの相対パス）。 */
  sourceFile: string
  sourceLineList: number[]
  originalSha256: string
  blockList: PlanBlock[]
  metricList: MetricSpec[]
  targetList: MetricTarget[]
  countList: ChapterMeasurement['countList']
  modelExamples: string
  instructions: string
}

/** インデックスシグネチャは、agentが書いたがワークフローが読まないフィールドを公開時にキー順ごと保持するため。 */
export interface RevisionCandidate {
  id: string
  start: number
  end: number
  before: string
  after: string
  targetList?: string[]
  displayReason?: string
  tradeoff?: string
  modelRefList?: string[]
  [field: string]: unknown
}

/** targetごとの結論（agentがスコープ全体を読んで書く）。全targetに必須。 */
export interface TargetReview {
  target: string
  reason: string
}

/** 改稿全文を通読した承認記録。`revisedSha256`が評価結果と一致する場合だけ有効。 */
export interface FinalReview {
  revisedSha256?: string
  verdict?: string
  reason?: string
}

/** `candidatesN.json`の形。省略されたフィールドは空として扱う。 */
export interface CandidatesFile {
  candidateList?: RevisionCandidate[]
  targetReviewList?: TargetReview[]
  bundleList?: string[][]
  finalReview?: FinalReview
}

/** 評価で見つかる問題の種類（revision-workflow.md「採用しない場合」）。 */
export type ProblemReason =
  | 'overshoot'
  | 'targetRegression'
  | 'newStandout'
  | 'noImprovement'
  | 'declaredTargetNotImproved'
  | 'denominatorOnly'

/** 評価で見つかった問題1件。`target`がnullなのはスコープ全体に関わる問題（改善なし）。 */
export interface Problem {
  target: string | null
  reason: ProblemReason
}

/** 採用した候補と、それで改善したtarget。 */
export interface EvaluationStep {
  added: string[]
  improved: string[]
}

/** 評価後のtargetの残差。`reached`はお手本の値に一致、`preserveExpression`はそれ以外（表現を壊してまで寄せない。理由は`reason`）。 */
export interface Residual extends Budget {
  id: string
  status: 'reached' | 'preserveExpression'
  reason: string
}

/** `evaluationN.json`の形。 */
export interface EvaluationPayload {
  version: string
  section: number
  selected: string[]
  problemList: Problem[]
  stepList: EvaluationStep[]
  residualList: Residual[]
  revisedSha256: string
  revisedText: string
  measurementList: { before: unknown; after: unknown }
  search: string
}

/** 公開データの`metricList[]`1件。改稿前後の値とお手本との差の動き。 */
export interface PublishedMetric {
  path: string
  label: string
  unit: string
  model: number
  before: number
  after: number
  target: boolean
  /** 追加された`lsm.mean`行にはこのフィールドが無い（保存済み出力の構造と一致させるため）。 */
  movement?: '縮小' | '拡大' | '同じ'
}

/** 候補の任意フィールドをそのまま保つため、具体的な型を付けていない。 */
export type PublishedEdit = Record<string, unknown>

/** `diff_dataN.json`の形（revision-workflow.md「diff_dataN.json」）。画面は`src/lib/data/report-data.ts`の`DiffData`で読む。 */
export interface PublishedDiffData {
  version: string
  revisionStatus: string
  section: number
  label: string
  /** スコープの原資料ファイル名（`pathList.editedSource`からの相対パス）。 */
  sourceFile: string
  sourceHashList: Record<string, string>
  originalTextSha256: string
  revisedTextSha256: string
  editList: PublishedEdit[]
  metricList: PublishedMetric[]
  measurementList: { before: unknown; after: unknown }
  residualList: Residual[]
  finalReview: FinalReview
}
