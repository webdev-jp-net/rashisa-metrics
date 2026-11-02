import { join } from 'node:path';
import type { ReportConfig } from '../config/report-config';
import type { AbsoluteLimitList, Policy, SummaryAssessment, SummaryNote } from '../policy/overview-policy';
import { readJson } from './json-io';
import type { CorpusSize, MeasurementResult, SourceFile } from './types';

// ---------------------------------------------------------------------------
// comparison_data.json / comparison_data{n}.json
// ---------------------------------------------------------------------------

/** LSM1カテゴリの比較。`model`・`edited`は使用比率、`lsm`はその一致度。 */
export interface LsmComparisonRow {
  category: string;
  label: string;
  model: number;
  edited: number;
  lsm: number;
}

/** LSM観点の比較データ。`formula`は計算式の記録（読む処理は無い）。`mean`が平均LSM。 */
export interface LsmComparisonBlock {
  formula: string;
  categoryList: LsmComparisonRow[];
  mean: number;
}

/** [label, model_value, edited_value] の3要素配列。1番目のみ文字列で残り2つは数値。 */
export type ComparisonTriple = [string, number, number];

export interface SentenceEndingComparisonBlock {
  unit: string;
  rowList: ComparisonTriple[];
}

export interface PolitenessComparisonBlock {
  unit: string;
  rowList: ComparisonTriple[];
}

export interface LengthComparisonBlock {
  unit: string;
  rowList: {
    sentence: ComparisonTriple[];
    paragraph: ComparisonTriple[];
  };
}

/** comparison_data.json（全体スコープ）とcomparison_data{n}.json（個別スコープ）で共通のフィールド。 */
export interface ComparisonScopeData {
  lsm: LsmComparisonBlock;
  sentenceEnding: SentenceEndingComparisonBlock;
  politeness: PolitenessComparisonBlock;
  length: LengthComparisonBlock;
}

/** 全体スコープの入力元（プロファイルの所在・ハッシュ・コーパスサイズ・計測に使った原資料）。 */
export interface ComparisonTotalSource {
  path: string;
  sha256: string;
  corpusSize: CorpusSize;
  sourceFileList: SourceFile[];
}

/** `comparison_data.json`（全体スコープ）の形。 */
export interface ComparisonTotalFile extends ComparisonScopeData {
  sourceList: ComparisonTotalSource[];
  comparisonScope: string;
}

/** 個別スコープの入力元。 */
export interface ComparisonChapterSource {
  path: string;
  sha256: string;
  corpusSize: CorpusSize;
}

/** 観点ごとの棒グラフ上限。値は`src/lib/policy/comparison.ts`の`CHAPTER_AXIS_LIST`。 */
export interface ComparisonChapterAxisList {
  endings: number;
  politeness: number;
  sentence: number;
  paragraph: number;
}

/** `comparison_dataN.json`（個別スコープ）の形。`section`がスコープid。 */
export interface ComparisonChapterFile extends ComparisonScopeData {
  section: number;
  label: string;
  sourceList: ComparisonChapterSource[];
  axisList: ComparisonChapterAxisList;
}

/**
 * 全体スコープの比較データ`comparison_data.json`のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 絶対パス。
 */
export function comparisonTotalPath(config: ReportConfig): string {
  return join(config.pathList.report, 'comparison_data.json');
}

/**
 * スコープ別の比較データ`comparison_dataN.json`のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パス。
 */
export function comparisonChapterPath(config: ReportConfig, scope: number): string {
  return join(config.pathList.report, `comparison_data${scope}.json`);
}

/**
 * 全体スコープの比較データ。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns ファイル内容。
 */
export function loadComparisonTotal(config: ReportConfig): ComparisonTotalFile {
  return readJson<ComparisonTotalFile>(comparisonTotalPath(config));
}

/**
 * 1スコープ分の比較データ。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns ファイル内容。
 */
export function loadComparisonChapter(config: ReportConfig, scope: number): ComparisonChapterFile {
  return readJson<ComparisonChapterFile>(comparisonChapterPath(config, scope));
}

/**
 * スコープ別の比較データを、設定`scopeList`のid昇順で全件。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 設定`scopeList`と同じ件数（スコープid順）。
 */
export function loadComparisonChapterList(config: ReportConfig): ComparisonChapterFile[] {
  const idList = [...config.scopeList].sort((a, b) => a.id - b.id).map(scope => scope.id);
  return idList.map(scope => loadComparisonChapter(config, scope));
}

// ---------------------------------------------------------------------------
// overview_criteria.json
// ---------------------------------------------------------------------------

/** 根拠にした比較データとそのハッシュ。`prepare`が鮮度確認に使う。 */
export interface OverviewCriteriaSource {
  comparisonFile: string;
  sha256: string;
}

/** 一覧の1列。`valueList`は行0が全体スコープ、以降が`config.scopeList`のid昇順。`flaggedRowList`は強調した行のindex。 */
export interface OverviewCriteriaColumn {
  group: string;
  item: string;
  unit: string;
  counted: boolean;
  model: number | null;
  limit: number | null;
  valueList: number[];
  flaggedRowList: number[];
}

/** スコープ1件の寸評。画面は読まず、`overview_criteria.json`にだけ書き出される。 */
export interface OverviewCriteriaComment {
  label: string;
  lsm: number;
  bulletList: string[];
  action: string;
  text: string;
}

/** `overview_criteria.json`の形（overview-policy.md「overview_criteria.json」）。 */
export interface OverviewCriteria {
  method: string;
  status: string;
  relativeLimit: number;
  absoluteLimitList: AbsoluteLimitList;
  lsmSynchronyThreshold: number;
  excluded: string[];
  policy: Policy;
  sourceList: OverviewCriteriaSource[];
  countDenominator: number;
  labelList: string[];
  countList: number[];
  columnList: OverviewCriteriaColumn[];
  commentList: OverviewCriteriaComment[];
  assessmentList: SummaryAssessment[];
  summary: SummaryNote[];
}

/**
 * 一覧の根拠データ`overview_criteria.json`のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 絶対パス。
 */
export function overviewCriteriaPath(config: ReportConfig): string {
  return join(config.pathList.report, 'overview_criteria.json');
}

/**
 * 一覧の根拠データ。画面は読まず、`revision.ts prepare`が使う。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns ファイル内容。
 */
export function loadOverviewCriteria(config: ReportConfig): OverviewCriteria {
  return readJson<OverviewCriteria>(overviewCriteriaPath(config));
}

// ---------------------------------------------------------------------------
// finding_texts.json
// ---------------------------------------------------------------------------

/** 総評1段落の根拠（一覧の項目と実例集のid）。 */
export interface FindingEvidenceEntry {
  itemList: string[];
  exemplarList: string[];
}

/** 観点1つ分の総評（見出し・段落・根拠）。 */
export interface FindingAxisText {
  heading: string;
  paragraphList: string[];
  evidence: FindingEvidenceEntry[];
}

/** スコープ1件分の総評。4観点それぞれを持つ。 */
export interface FindingTextsEntry {
  lsm: FindingAxisText;
  endings: FindingAxisText;
  politeness: FindingAxisText;
  length: FindingAxisText;
}

/** スコープをキーにする: 全体は'all'、個別スコープは文字列化したindex（'0'〜'9'）。 */
export type FindingTexts = Record<string, FindingTextsEntry>;

/**
 * 総評本文`finding_texts.json`のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 絶対パス。
 */
export function findingTextsPath(config: ReportConfig): string {
  return join(config.pathList.report, 'finding_texts.json');
}

/**
 * 総評本文。画面の総評はこのファイルだけを入力にする。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns ファイル内容。
 */
export function loadFindingTexts(config: ReportConfig): FindingTexts {
  return readJson<FindingTexts>(findingTextsPath(config));
}

// ---------------------------------------------------------------------------
// diff_data{n}.json
// ---------------------------------------------------------------------------

/** 公開済みの変更案1件。位置（`start`/`end`）はスコープ本文内の文字オフセット。 */
export interface DiffEdit {
  id: string;
  targetList: string[];
  start: number;
  end: number;
  before: string;
  after: string;
  displayReason: string;
  tradeoff: string;
  modelRefList: string[];
  target: string;
  metricPath: string;
  label: string;
  sourceLine: number;
  /** version 'chapter-local-edits-1'で生成された場合のみ存在する。 */
  before_hits?: unknown[];
  after_hits?: unknown[];
  isolated?: { model: number; before: number; after: number };
}

/** 変更案の再測定テーブルの1行。`target`がtrueの指標が基準超過（変更案の対象）。 */
export interface DiffMetric {
  path: string;
  label: string;
  unit: string;
  model: number;
  before: number;
  after: number;
  target: boolean;
  movement: string;
}

/** targetごとの残差。`src/lib/revision/types.ts`の`Residual`と同じキー（こちらはnullを許さない）。 */
export interface DiffResidual {
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

/** 改稿全文を通読した承認記録。 */
export interface DiffFinalReview {
  revisedSha256: string;
  verdict: string;
  reason: string;
}

/**
 * 実際に存在するdata/<seriesKey>/report/diff_data{n}.jsonはすべてversion 'chapter-revision-4'で、revisionの
 * publish工程が生成する。このversionは`revisionStatus`・`residualList`・`finalReview`を持ち、
 * 旧version 'chapter-local-edits-1'が持っていた`baselineVerified`・`chapterProfileSha256`・
 * `overviewComment`・`packages`は持たない。両versionを同じ型で扱えるよう、該当フィールドは
 * すべてoptionalにしている。
 */
export interface DiffData {
  version: string;
  revisionStatus?: string;
  section: number;
  label: string;
  /** スコープの原資料ファイル名（`pathList.editedSource`からの相対パス）。 */
  sourceFile: string;
  sourceHashList: Record<string, string>;
  originalTextSha256: string;
  revisedTextSha256: string;
  editList: DiffEdit[];
  metricList: DiffMetric[];
  measurementList: {
    before: MeasurementResult;
    after: MeasurementResult;
  };
  residualList?: DiffResidual[];
  finalReview?: DiffFinalReview;
  baselineVerified?: boolean;
  chapterProfileSha256?: string;
  overviewComment?: OverviewCriteriaComment;
  packages?: Record<string, string>;
}

/**
 * 公開済み変更案`diff_dataN.json`のパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パス。
 */
export function diffDataPath(config: ReportConfig, scope: number): string {
  return join(config.pathList.report, `diff_data${scope}.json`);
}

/**
 * 1スコープ分の公開済み変更案。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns ファイル内容。
 */
export function loadDiffData(config: ReportConfig, scope: number): DiffData {
  return readJson<DiffData>(diffDataPath(config, scope));
}

/**
 * 公開済み変更案を、設定`scopeList`のid昇順で全件。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 設定`scopeList`と同じ件数（スコープid順）。
 */
export function loadAllDiffData(config: ReportConfig): DiffData[] {
  const idList = [...config.scopeList].sort((a, b) => a.id - b.id).map(scope => scope.id);
  return idList.map(scope => loadDiffData(config, scope));
}
