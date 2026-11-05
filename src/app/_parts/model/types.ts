import type { DiffRow } from '@/lib/diff'

/** 4観点の識別子（dictionary.md「観点」）。 */
export type ViewpointKey = 'lsm' | 'endings' | 'politeness' | 'length'

/** 観点の説明カードとタブの文言。 */
export interface ViewpointDefinition {
  key: ViewpointKey
  name: string
  tabLabel: string
  subtitle?: string
  text: string
  example?: string
}

/** 1観点分の総評。 */
export interface FindingModel {
  heading: string
  paragraphList: string[]
}

/** LSM図の1カテゴリ分の行。 */
export interface LsmCategoryRow {
  label: string
  model: number
  edited: number
  lsm: number
}

/** LSM図の表示モデル。 */
export interface LsmFigureModel {
  rowList: LsmCategoryRow[]
  average: number
  editedLabel: string
  modelLabel: string
}

/** [項目ラベル, お手本媒体の値, 編集対象媒体の値] */
export type PairChartRow = [string, number, number]

/** ペア棒グラフの表示モデル。`seriesList`は[お手本, 編集対象]の表示名。 */
export interface PairChartModel {
  title: string
  rowList: PairChartRow[]
  maximum: number
  unit: string
  seriesList: [string, string]
  chartLabel?: string
}

/** 分析パネル（4観点の図表と総評）の表示モデル。 */
export interface AnalysisModel {
  lsm: { figure: LsmFigureModel; finding: FindingModel }
  endings: { chart: PairChartModel; finding: FindingModel }
  politeness: { chart: PairChartModel; finding: FindingModel }
  length: { chartList: PairChartModel[]; finding: FindingModel }
}

/** 一覧表の1列。 */
export interface ComparisonColumn {
  group: string
  item: string
  /** data-group属性の値。文法語列はLSMフィルタでも表示される。 */
  displayGroup: string
  /** data-main属性の値：主要項目フィルタの対象かどうか。 */
  main: boolean
}

/** 一覧表の1セル。`standout`は基準超過（強調）。 */
export interface ComparisonCell {
  text: string
  standout: boolean
  title: string
  displayGroup: string
  main: boolean
}

/** 一覧表の1行（スコープ）。 */
export interface ComparisonRow {
  scopeKey: string
  label: string
  count: number
  countTitle: string
  chars: string
  cellList: ComparisonCell[]
}

/** 列フィルタのボタン1つ。 */
export interface ComparisonFilter {
  view: string
  label: string
  badge?: number
}

/** 一覧表の表示モデル。 */
export interface ComparisonTableModel {
  columnList: ComparisonColumn[]
  rowList: ComparisonRow[]
  filterList: ComparisonFilter[]
  denominator: number
  regionLabel: string
  hintList: string[]
}

/** 全体スコープの総括の表示モデル。 */
export interface TotalProposalModel {
  kind: 'total'
  leadText: string
  overallText: string
  /** 各要素の間に改行を挟み、1つの段落として表示する。 */
  rangeLineList: string[]
  suggestionListLabel: string
  suggestionList: string[]
  table: ComparisonTableModel
}

/** 書式化済みの値と単位。 */
export interface MetricValue {
  value: string
  unit: string
}

/** 再測定テーブルの1行。 */
export interface MetricListEntry {
  item: string
  before: MetricValue
  after: MetricValue
  model: MetricValue
  direction: 'plus' | 'minus' | ''
}

/** 再測定テーブルの観点ごとのまとまり。 */
export interface MetricListGroup {
  genre: string
  badge: number
  heading: string
  entryList: MetricListEntry[]
}

/** diff提案の表示モデル。 */
export interface DiffBoxModel {
  scope: number
  title: string
  rowList: DiffRow[]
}

/** 変更案適用前後の平均LSM。 */
export interface LsmBeforeAfterModel {
  before: string
  after: string
}

/** 個別スコープの変更案の表示モデル。 */
export interface ScopeProposalModel {
  kind: 'scope'
  lead: string
  lsm: LsmBeforeAfterModel
  metricList: MetricListGroup[]
  metricListHeaderList: string[]
  diff: DiffBoxModel
}

/** 変更案パネルの表示モデル。全体スコープと個別スコープで形が違う。 */
export type ProposalModel = TotalProposalModel | ScopeProposalModel

/** スコープ1つ分の表示モデル。`key`は`total`か`0`〜`9`。 */
export interface ScopeModel {
  key: string
  label: string
  panelId: string
  proposal: ProposalModel | null
  analysis: AnalysisModel
}

/** ページ全体の表示モデル。`buildReportModel`が組み立てる。 */
export interface ReportModel {
  site: { title: string; lead: string }
  media: { model: string; edited: string }
  viewpointList: ViewpointDefinition[]
  scopeList: ScopeModel[]
  /** `descriptionHtml`はサニタイズ済みの導入文のHTML。 */
  hero: { descriptionHtml: string; hintLabel: string }
  intro: { paragraphList: string[][]; hintLabel: string }
  analysisTitle: string
}
