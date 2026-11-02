/**
 * @file 画面が表示に使う材料の取得元（microCMS）。APIキーはサーバー側だけが持つ。
 *   2つのAPI（`series`・`report`）の型と取得関数を置く。フィールドの定義は_llm-docs側の仕様書が正本。
 */
import { createClient } from 'microcms-js-sdk'
import type { MicroCMSListContent, MicroCMSListResponse, MicroCMSQueries } from 'microcms-js-sdk'

/** シリーズ（お手本と編集対象の組）のAPI（リスト形式）。 */
export const SERIES_ENDPOINT = 'series'
/** スコープごとの表示材料のAPI（リスト形式）。 */
export const REPORT_ENDPOINT = 'report'
/** 全体スコープの`scope`の値。個別スコープは`scopeList[].scopeId`を文字列にした値。 */
export const TOTAL_SCOPE = 'total'

/**
 * 一覧を取るときの件数。microCMSの既定は10件で、全体＋個別スコープの`report`を取りこぼすため明示する。
 */
const LIST_LIMIT = 100

/** 繰り返しフィールドのスコープ1件。`id`はmicroCMSの予約語のため`scopeId`で持つ。 */
export interface ScopeEntry {
  fieldId: 'scope'
  scopeId: number
  label: string
}

/** LSM内訳の1行。 */
export interface LsmCategoryEntry {
  fieldId: 'lsmCategory'
  label: string
  model: number
  edited: number
  lsm: number
}

/** 文末表現・敬語の密度・文長・段落長に共通の比較1行。 */
export interface ComparisonRowEntry {
  fieldId: 'comparisonRow'
  label: string
  model: number
  edited: number
}

/** 総評の観点（dictionary.md「観点」）。 */
export type FindingAxis = 'lsm' | 'endings' | 'politeness' | 'length'

/**
 * 総評1観点分。`paragraphList`は1段落1行、`evidenceItemList`・`evidenceExemplarList`は1行1件のテキストエリア。
 * `axis`はセレクトなので、値が1つでも配列で持つ。
 */
export interface FindingEntry {
  fieldId: 'finding'
  axis: FindingAxis[]
  heading: string
  paragraphList: string
  evidenceItemList: string
  evidenceExemplarList: string
}

/** 変更案の理由行1件。`line`は変更前の本文の何行目か（0始まり）。 */
export interface ReasonEntry {
  fieldId: 'reason'
  line: number
  title: string
  reason: string
  tradeoff: string
}

/** 再測定の1行。画面は`target`かつ値が動いた行だけを表にする。 */
export interface MetricEntry {
  fieldId: 'metric'
  genre: string
  item: string
  unit: string
  before: number
  after: number
  model: number
  target: boolean
}

/** `series`のうち表示名とスコープ一覧のフィールド。管理画面とエージェントが登録し、送信コマンドは書かない。 */
export interface SeriesFields {
  seriesKey: string
  siteTitle: string
  siteLead: string
  modelLabel: string
  editedLabel: string
  scopeList: ScopeEntry[]
}

/**
 * `series`の内容。`allowList`は1行1件で、`@`を含めばメール完全一致、無ければドメイン一致。
 * 1件も登録していなければmicroCMSはこのフィールドを返さない。
 */
export interface Series extends SeriesFields {
  allowList?: string
}

/** 取得した`series`の1コンテンツ（コンテンツIDと日時を含む）。 */
export type SeriesContent = Series & MicroCMSListContent

/**
 * `report`のうち送信コマンドが書くフィールド。`findingList`は管理画面と`import-findings`が書くので含めない。
 * `series`は書くときはコンテンツID、取得時は参照先の内容ごと返る。全体スコープは変更案を持たないため、
 * `beforeText`以降は個別スコープだけが持つ。
 */
export interface ReportFields {
  series: string
  scope: string
  chars: number
  lsmMean: number
  lsmCategoryList: LsmCategoryEntry[]
  sentenceEndingList: ComparisonRowEntry[]
  politeness: ComparisonRowEntry[]
  sentenceLengthList: ComparisonRowEntry[]
  paragraphLengthList: ComparisonRowEntry[]
  proposalReady: boolean
  beforeText?: string
  afterText?: string
  reasonList?: ReasonEntry[]
  metricList?: MetricEntry[]
  lsmBefore?: number
  lsmAfter?: number
}

/** `report`の1コンテンツ。取得時の`series`は参照先の内容で、画面は`id`だけを読む。 */
export interface Report extends Omit<ReportFields, 'series'> {
  series: MicroCMSListContent
  findingList: FindingEntry[]
}

/** 取得した`report`の1コンテンツ（コンテンツIDと日時を含む）。 */
export type ReportContent = Report & MicroCMSListContent

/**
 * この連携が使うmicroCMSの操作だけを並べたもの。テストで偽のクライアントに差し替えられるよう、
 * SDKの戻り値そのものではなくこの形で受け渡す。
 */
export interface ReportCmsClient {
  getList: <T>(request: {
    endpoint: string
    queries?: MicroCMSQueries
  }) => Promise<MicroCMSListResponse<T>>
  create: (request: {
    endpoint: string
    contentId?: string
    content: Record<string, unknown>
  }) => Promise<{ id: string }>
  update: (request: {
    endpoint: string
    contentId?: string
    content: Record<string, unknown>
  }) => Promise<{ id: string }>
  delete: (request: { endpoint: string; contentId: string }) => Promise<void>
}

/**
 * 環境変数（`MICROCMS_SERVICE_DOMAIN`・`MICROCMS_API_KEY`）から既定のクライアントを作る。
 *
 * @returns クライアント。
 * @throws どちらかの環境変数が無ければ、名前を挙げて止める。
 */
export function createReportClient(): ReportCmsClient {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY
  if (!serviceDomain) {
    throw new Error('MICROCMS_SERVICE_DOMAIN is not set')
  }
  if (!apiKey) {
    throw new Error('MICROCMS_API_KEY is not set')
  }
  return createClient({ serviceDomain, apiKey })
}

/**
 * `seriesKey`でシリーズを1件引く。画面が表示するシリーズを、送信コマンドが送り先を決めるために使う。
 *
 * @param client クライアント。
 * @param seriesKey `data/index.json`の`seriesKey`、または画面のパスの`seriesKey`。
 * @returns 該当するシリーズ。無ければnull。
 */
export async function getSeriesByKey(
  client: ReportCmsClient,
  seriesKey: string
): Promise<SeriesContent | null> {
  const response = await client.getList<Series>({
    endpoint: SERIES_ENDPOINT,
    queries: { limit: 1, filters: `seriesKey[equals]${seriesKey}` },
  })
  return response.contents[0] ?? null
}

/**
 * シリーズを全件取る。ルートが閲覧できるシリーズの一覧を作るために使う。
 *
 * @param client クライアント。
 * @returns `series`の全コンテンツ。
 */
export async function getSeriesList(client: ReportCmsClient): Promise<SeriesContent[]> {
  const response = await client.getList<Series>({
    endpoint: SERIES_ENDPOINT,
    queries: { limit: LIST_LIMIT },
  })
  return response.contents
}

/**
 * 1シリーズ分のスコープごとの表示材料を全件取る。並び順はmicroCMSの既定（更新日時の降順）のままなので、
 * 画面は`scope`で引き当てる。
 *
 * @param client クライアント。
 * @param seriesId シリーズのコンテンツID。
 * @param queries microCMSのクエリ。件数を指定しなければ全件分の上限を使う。
 * @returns そのシリーズの`report`の全コンテンツ。
 */
export async function getReportList(
  client: ReportCmsClient,
  seriesId: string,
  queries?: MicroCMSQueries
): Promise<ReportContent[]> {
  const response = await client.getList<Report>({
    endpoint: REPORT_ENDPOINT,
    queries: { limit: LIST_LIMIT, filters: `series[equals]${seriesId}`, ...queries },
  })
  return response.contents
}
