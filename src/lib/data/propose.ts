import { join } from 'node:path';
import type { ReportConfig } from '../config/report-config';
import { readJson } from './json-io';
import type { MeasurementResult } from './types';

// ---------------------------------------------------------------------------
// data/<seriesKey>/propose/plan{n}.json
// ---------------------------------------------------------------------------

/** agentが候補を探す単位（`src/lib/revision/types.ts`の`PlanBlock`と同じ形）。 */
export interface PlanBlock {
  id: string;
  start: number;
  end: number;
  text: string;
}

/** 指標1件の仕様。`limit`は強調の閾値、`standout`は基準超過か。 */
export interface PlanMetric {
  id: string;
  path: string;
  label: string;
  group: string;
  unit: string;
  scale: number;
  model: number;
  before: number;
  limit: number;
  standout: boolean;
}

/** 探索の目安。`src/lib/revision/types.ts`の`Budget`と同じキー（こちらはnullを許さない）。 */
export interface PlanBudget {
  current: number;
  model: number;
  gap: number;
  direction: string;
  estimatedDeltaCount: number;
  targetCountAtCurrentDenominator: number;
  numerator: number;
  denominator: number;
}

/** 基準超過の指標。目安付き。 */
export interface PlanTarget extends PlanMetric {
  budget: PlanBudget;
}

/** 比率指標の分子（出現数）に数えた1出現。保持されるフィールドは指標ごとに異なる。 */
export interface PlanOccurrence {
  surface?: string;
  lemma?: string;
  rule?: string;
}

/** 指標1件の分子・分母・出現根拠。 */
export interface PlanCount {
  numerator: number;
  denominator: number;
  occurrenceList: PlanOccurrence[];
}

/** `planN.json`の形。 */
export interface Plan {
  version: string;
  section: number;
  label: string;
  sourceHashList: Record<string, string>;
  /** スコープの原資料ファイル名（`pathList.editedSource`からの相対パス）。 */
  sourceFile: string;
  sourceLineList: number[];
  originalSha256: string;
  blockList: PlanBlock[];
  metricList: PlanMetric[];
  targetList: PlanTarget[];
  /** 指標のpath（例: 'lsmCategory.ratioList.caseParticles'）をキーにする。 */
  countList: Record<string, PlanCount>;
  modelExamples: string;
  instructions: string;
}

/**
 * `data/<seriesKey>/propose/planN.json`（計画）のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パス。
 */
export function planPath(config: ReportConfig, scope: number): string {
  return join(config.pathList.propose, `plan${scope}.json`);
}

/**
 * 計画を読む。実行時の検証はしない（`readJson`と同じ）。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns ファイル内容。
 */
export function loadPlan(config: ReportConfig, scope: number): Plan {
  return readJson<Plan>(planPath(config, scope));
}

// ---------------------------------------------------------------------------
// data/<seriesKey>/propose/candidates{n}.json
// ---------------------------------------------------------------------------

/** agentが書いた候補1件。 */
export interface Candidate {
  id: string;
  targetList: string[];
  start: number;
  end: number;
  before: string;
  after: string;
  displayReason: string;
  tradeoff: string;
  modelRefList: string[];
}

/** targetごとの結論。 */
export interface TargetReview {
  target: string;
  reason: string;
}

/** 改稿全文を通読した承認記録。 */
export interface CandidateFinalReview {
  revisedSha256: string;
  verdict: string;
  reason: string;
}

/** `candidatesN.json`の形。 */
export interface Candidates {
  candidateList: Candidate[];
  targetReviewList: TargetReview[];
  /** サンプルデータでは値が入っている例を未観測。"array"であること以外、形は未確定。 */
  bundleList: unknown[];
  finalReview: CandidateFinalReview;
}

/**
 * `data/<seriesKey>/propose/candidatesN.json`（agentが書いた候補）のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パス。
 */
export function candidatesPath(config: ReportConfig, scope: number): string {
  return join(config.pathList.propose, `candidates${scope}.json`);
}

/**
 * 候補を読む。読者向け説明文の検査は`validateCopy`が別途行う。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns ファイル内容。
 */
export function loadCandidates(config: ReportConfig, scope: number): Candidates {
  return readJson<Candidates>(candidatesPath(config, scope));
}

// ---------------------------------------------------------------------------
// data/<seriesKey>/propose/evaluation{n}.json
// ---------------------------------------------------------------------------

/** 採用した候補と、それで改善したtarget。 */
export interface EvaluationStep {
  added: string[];
  improved: string[];
}

/** targetごとの残差。 */
export interface EvaluationResidual {
  id: string;
  status: string;
  current: number;
  model: number;
  gap: number;
  direction: string;
  estimatedDeltaCount: number;
  targetCountAtCurrentDenominator: number;
  numerator: number;
  denominator: number;
  reason: string;
}

/** `evaluationN.json`の形。 */
export interface Evaluation {
  version: string;
  section: number;
  selected: string[];
  /** サンプルデータでは値が入っている例を未観測。"array"であること以外、形は未確定。 */
  problemList: unknown[];
  stepList: EvaluationStep[];
  residualList: EvaluationResidual[];
  revisedSha256: string;
  revisedText: string;
  measurementList: {
    before: MeasurementResult;
    after: MeasurementResult;
  };
  search: string;
}

/**
 * `data/<seriesKey>/propose/evaluationN.json`（評価）のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パス。
 */
export function evaluationPath(config: ReportConfig, scope: number): string {
  return join(config.pathList.propose, `evaluation${scope}.json`);
}

/**
 * 評価を読む。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns ファイル内容。
 */
export function loadEvaluation(config: ReportConfig, scope: number): Evaluation {
  return readJson<Evaluation>(evaluationPath(config, scope));
}
