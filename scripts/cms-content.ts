/**
 * @file 送信コマンド（`scripts/cms.ts`）が送る内容の組み立てと、microCMSへの書き込み。
 *   画面の表示材料を作る`scopeReportMaterial`を使うため、画面層に依存できるこの階層（scripts）に置く。
 */
import {
  getReportList,
  getSeriesByKey,
  REPORT_ENDPOINT,
  SERIES_ENDPOINT,
  TOTAL_SCOPE,
  type ComparisonRowEntry,
  type FindingAxis,
  type FindingEntry,
  type LsmCategoryEntry,
  type MetricEntry,
  type ReasonEntry,
  type ReportCmsClient,
  type ReportContent,
  type ReportFields,
  type SeriesContent,
} from '../src/lib/api/microcms'
import type { ReportConfig, ReportScope } from '../src/lib/config/report-config'
import {
  loadComparisonChapter,
  loadComparisonTotal,
  type ComparisonScopeData,
  type ComparisonTriple,
  type FindingTexts,
} from '../src/lib/data/report-data'
import { deepEqual, ensure } from '../src/lib/revision/io'
import {
  scopeReportMaterial,
  type ScopeReportMaterial,
} from '../src/app/_parts/model/scope-proposal'

/** 総評が持つ観点。画面が4観点そろっていることを求めるので、取り込みでも同じ4つを要求する。 */
const FINDING_AXIS_LIST: FindingAxis[] = ['lsm', 'endings', 'politeness', 'length']

/** 送信する`report`のフィールド。`series`（送り先のシリーズ）は書き込み時に付ける。 */
export type ReportScopeFields = Omit<ReportFields, 'series'>

/** 送信する`report`の1コンテンツ。シリーズの中では`scope`で1件に決まる。 */
export interface ReportContentInput {
  scope: string
  fields: ReportScopeFields
}

/**
 * `--check`で出す1コンテンツ分の差分。`target`は`report`の`scope`の値。
 * `missing`はmicroCMS側にまだコンテンツが無いこと、`stale`はスコープと原稿ファイルの対応に無いスコープの
 * `report`がシリーズに残っていること（`push`が削除する）。
 */
export interface ContentDifference {
  target: string
  missing: boolean
  stale: boolean
  fieldList: string[]
}

/** `push`が実際に行った書き込み。 */
export interface PushResult {
  reportList: { scope: string; action: 'created' | 'updated' | 'deleted' }[]
}

/** `import-findings`が書き込んだコンテンツ。 */
export interface ImportFindingsResult {
  reportList: { scope: string; findings: number }[]
}

/** `push`の結果。`--check`のときは差分だけを返し、1件も書き込まない。 */
export type PushCommandResult =
  | { check: true; reportCount: number; differenceList: ContentDifference[] }
  | ({ check: false } & PushResult)

/** 比較データから作るフィールド。全スコープが持つ。 */
type ComparisonFields = Pick<
  ReportScopeFields,
  | 'chars'
  | 'lsmMean'
  | 'lsmCategoryList'
  | 'sentenceEndingList'
  | 'politeness'
  | 'sentenceLengthList'
  | 'paragraphLengthList'
>

/** 変更案から作るフィールド。個別スコープだけが持ち、未完了なら空値で送る。 */
type ProposalFields = Required<
  Pick<
    ReportScopeFields,
    'beforeText' | 'afterText' | 'reasonList' | 'metricList' | 'lsmBefore' | 'lsmAfter'
  >
>

/**
 * スコープをid昇順で。設定ファイル上の並びには依存しない。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns id昇順のスコープ。
 */
function sortedScopeList(config: ReportConfig): ReportScope[] {
  return [...config.scopeList].sort((a, b) => a.id - b.id)
}

/**
 * 比較データの3要素配列（ラベル・お手本・編集対象）を繰り返しフィールドの行にする。
 *
 * @param rowList 比較データの行。
 * @returns 繰り返しフィールドの行。
 */
function comparisonRowList(rowList: ComparisonTriple[]): ComparisonRowEntry[] {
  return rowList.map(([label, model, edited]) => ({
    fieldId: 'comparisonRow',
    label,
    model,
    edited,
  }))
}

/**
 * 全スコープに共通する比較データのフィールド。表示名はmicroCMSの`series`が正本なので送らない。
 *
 * @param chars 編集対象媒体の文字数。
 * @param data スコープの比較データ。
 * @returns 比較データ由来のフィールド。
 */
function comparisonFields(chars: number, data: ComparisonScopeData): ComparisonFields {
  const lsmCategoryList: LsmCategoryEntry[] = data.lsm.categoryList.map(row => ({
    fieldId: 'lsmCategory',
    label: row.label,
    model: row.model,
    edited: row.edited,
    lsm: row.lsm,
  }))
  return {
    chars,
    lsmMean: data.lsm.mean,
    lsmCategoryList,
    sentenceEndingList: comparisonRowList(data.sentenceEnding.rowList),
    politeness: comparisonRowList(data.politeness.rowList),
    sentenceLengthList: comparisonRowList(data.length.rowList.sentence),
    paragraphLengthList: comparisonRowList(data.length.rowList.paragraph),
  }
}

/**
 * 変更案が未完了のスコープに送るフィールド。以前`complete`だったスコープが原稿の差し替えで未完了に
 * 戻ることがあり、更新はPATCHなので、送らずにおくと前回送った本文・理由行がそのまま残ってしまう。
 * 空値で上書きして消す。
 *
 * @returns 空値の変更案フィールド。
 */
function clearedProposalFields(): ProposalFields {
  return {
    beforeText: '',
    afterText: '',
    reasonList: [],
    metricList: [],
    lsmBefore: 0,
    lsmAfter: 0,
  }
}

/**
 * 変更案由来のフィールド。個別スコープだけが持つ。
 *
 * @param material 表示材料（`scopeReportMaterial`の結果）。
 * @returns 変更案由来のフィールド。
 */
function proposalFields(material: ScopeReportMaterial): ProposalFields {
  const reasonList: ReasonEntry[] = material.reasonList.map(reason => ({
    fieldId: 'reason',
    line: reason.line,
    title: reason.title,
    reason: reason.reason,
    tradeoff: reason.tradeoff,
  }))
  const metricList: MetricEntry[] = material.metricList.map(metric => ({
    fieldId: 'metric',
    genre: metric.genre,
    item: metric.item,
    unit: metric.unit,
    before: metric.before,
    after: metric.after,
    model: metric.model,
    target: metric.target,
  }))
  return {
    beforeText: material.beforeText,
    afterText: material.afterText,
    reasonList,
    metricList,
    lsmBefore: material.lsmBefore,
    lsmAfter: material.lsmAfter,
  }
}

/**
 * `report`に送る内容を全スコープ分。個別スコープは`scopeReportMaterial`が原稿・改稿のハッシュと
 * 変更案の`before`を検証するので、不一致があればここで止まり、1件も送られない。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 全体スコープを先頭にした、`scope`と内容の組。
 * @throws 検証に失敗したスコープがあれば、全件を列挙して止める。
 */
export function buildReportContentList(config: ReportConfig): ReportContentInput[] {
  const total = loadComparisonTotal(config)
  const contentList: ReportContentInput[] = [
    {
      scope: TOTAL_SCOPE,
      fields: {
        scope: TOTAL_SCOPE,
        ...comparisonFields(total.sourceList[1].corpusSize.chars, total),
        proposalReady: false,
      },
    },
  ]

  const failureList: string[] = []
  for (const scope of sortedScopeList(config)) {
    const comparison = loadComparisonChapter(config, scope.id)
    let material: ScopeReportMaterial | null = null
    try {
      material = scopeReportMaterial(config, scope.id)
    } catch (error) {
      failureList.push(error instanceof Error ? error.message : String(error))
      continue
    }
    contentList.push({
      scope: String(scope.id),
      fields: {
        scope: String(scope.id),
        ...comparisonFields(comparison.sourceList[1].corpusSize.chars, comparison),
        proposalReady: material !== null,
        ...(material === null ? clearedProposalFields() : proposalFields(material)),
      },
    })
  }

  if (failureList.length > 0) {
    throw new Error(
      `${failureList.join('\n')}\n` +
        '原稿と公開済みの変更案が一致しないため、1件も送信していません。' +
        '該当スコープを publish し直してから再実行してください。'
    )
  }
  return contentList
}

/**
 * シリーズにある`report`を`scope`で引ける形にする。
 *
 * @param client クライアント。
 * @param seriesId シリーズのコンテンツID。
 * @returns `scope`→コンテンツ。
 */
async function reportByScope(
  client: ReportCmsClient,
  seriesId: string
): Promise<Map<string, ReportContent>> {
  const reportList = await getReportList(client, seriesId)
  return new Map(reportList.map(report => [report.scope, report]))
}

/**
 * 送り先のシリーズを`seriesKey`で引く。`push`・`import-findings`はシリーズを作らない（表示名を含む`series`の
 * 登録は管理画面とエージェントが行う）ので、無ければ止める。
 *
 * @param client クライアント。
 * @param seriesKey `data/index.json`の`seriesKey`。
 * @returns 該当するシリーズ。
 * @throws シリーズがmicroCMSに無ければ止める。
 */
async function requireSeries(client: ReportCmsClient, seriesKey: string): Promise<SeriesContent> {
  const series = await getSeriesByKey(client, seriesKey)
  ensure(
    series !== null,
    `${SERIES_ENDPOINT}: no content has seriesKey '${seriesKey}'. ` +
      'Register the series in microCMS first; push and import-findings do not create it.'
  )
  return series
}

/**
 * 送る内容と、いまmicroCMSにある内容の差分。値が違うフィールド名だけを列挙する。スコープと原稿ファイルの対応に
 * 無いスコープの`report`は`stale`として返す。
 *
 * @param client クライアント。
 * @param seriesKey 送り先のシリーズの`seriesKey`。
 * @param contentList `report`に送る内容。
 * @returns 差分のあるコンテンツ。無ければ空。
 * @throws シリーズがmicroCMSに無ければ止める。
 */
export async function checkContentList(
  client: ReportCmsClient,
  seriesKey: string,
  contentList: ReportContentInput[]
): Promise<ContentDifference[]> {
  const differenceList: ContentDifference[] = []
  const existingSeries = await requireSeries(client, seriesKey)

  const byScope = await reportByScope(client, existingSeries.id)
  for (const content of contentList) {
    const existing = byScope.get(content.scope)
    if (existing === undefined) {
      differenceList.push({
        target: content.scope,
        missing: true,
        stale: false,
        fieldList: Object.keys(content.fields),
      })
      continue
    }
    const fieldList = changedFieldList(content.fields, existing)
    if (fieldList.length > 0) {
      differenceList.push({ target: content.scope, missing: false, stale: false, fieldList })
    }
  }
  const sending = new Set(contentList.map(content => content.scope))
  for (const scope of byScope.keys()) {
    if (!sending.has(scope)) {
      differenceList.push({ target: scope, missing: false, stale: true, fieldList: [] })
    }
  }
  return differenceList
}

/**
 * 型付きのフィールドを、クライアントが受け取る形にする。値は変えない。
 *
 * @param fields 送る内容。
 * @returns 同じ値。
 */
function asContent(fields: object): Record<string, unknown> {
  return fields as Record<string, unknown>
}

/**
 * 空文字列のフィールドを取り除く。microCMSは空文字列のフィールドを応答に含めないため
 * （`allowList`と同じ仕様）、送る内容の空文字列と、取得した内容にそのフィールドが無いことを
 * 同じとみなして比較する。
 *
 * @param value 比較対象の値。
 * @returns 空文字列のフィールドを除いた値。
 */
function stripEmptyStrings(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmptyStrings)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== '')
        .map(([key, v]) => [key, stripEmptyStrings(v)])
    )
  }
  return value
}

/**
 * 送る値と現在の値を、送るフィールドだけ突き合わせる。送らないフィールド（`allowList`・`findingList`）は見ない。
 *
 * @param next 送る内容。
 * @param current 取得した内容。
 * @returns 値が違うフィールド名。
 */
function changedFieldList(next: object, current: object): string[] {
  const left = asContent(next)
  const right = asContent(current)
  return Object.keys(left).filter(
    key => !deepEqual(stripEmptyStrings(left[key]), stripEmptyStrings(right[key]))
  )
}

/**
 * `report`をmicroCMSへ書く。送り先のシリーズは`seriesKey`で探し、無ければ止める（`series`は書かない）。
 * `report`はそのシリーズの中で`scope`が一致するコンテンツをPATCHで更新し（送らない`findingList`は触らない）、
 * 無ければ作る。コンテンツIDは自動発行。スコープと原稿ファイルの対応に無いスコープの`report`がシリーズに
 * 残っていれば削除する。
 *
 * @param client クライアント。
 * @param seriesKey 送り先のシリーズの`seriesKey`。
 * @param contentList `report`に送る内容。
 * @returns 書き込んだ結果。
 * @throws シリーズがmicroCMSに無ければ、1件も書かずに止める。
 */
export async function pushContents(
  client: ReportCmsClient,
  seriesKey: string,
  contentList: ReportContentInput[]
): Promise<PushResult> {
  const seriesId = (await requireSeries(client, seriesKey)).id
  const byScope = await reportByScope(client, seriesId)
  const reportList: PushResult['reportList'] = []
  for (const content of contentList) {
    const fields: ReportFields = { ...content.fields, series: seriesId }
    const existing = byScope.get(content.scope)
    if (existing !== undefined) {
      await client.update({
        endpoint: REPORT_ENDPOINT,
        contentId: existing.id,
        content: asContent(fields),
      })
      reportList.push({ scope: content.scope, action: 'updated' })
      continue
    }
    await client.create({ endpoint: REPORT_ENDPOINT, content: asContent(fields) })
    reportList.push({ scope: content.scope, action: 'created' })
  }

  const sending = new Set(contentList.map(content => content.scope))
  for (const [scope, existing] of byScope) {
    if (sending.has(scope)) continue
    await client.delete({ endpoint: REPORT_ENDPOINT, contentId: existing.id })
    reportList.push({ scope, action: 'deleted' })
  }
  return { reportList }
}

/**
 * `push`の本体。送る内容を全スコープ分そろえてから書き込みへ進むので、検証に1件でも失敗すれば
 * microCMSへの書き込みは1度も起きない。`--check`は差分を返すだけで書き込まない。
 *
 * @param client クライアント。
 * @param config 設定（`loadReportConfig`の結果）。
 * @param options `check`がtrueなら送信せず差分だけを返す。
 * @returns 書き込んだ結果、または差分。
 * @throws 送る内容を組み立てられない、またはシリーズがmicroCMSに無ければ、書き込む前に止める。
 */
export async function runPush(
  client: ReportCmsClient,
  config: ReportConfig,
  options: { check?: boolean } = {}
): Promise<PushCommandResult> {
  const contentList = buildReportContentList(config)
  if (options.check === true) {
    return {
      check: true,
      reportCount: contentList.length,
      differenceList: await checkContentList(client, config.seriesKey, contentList),
    }
  }
  return { check: false, ...(await pushContents(client, config.seriesKey, contentList)) }
}

/**
 * 総評本文を、`seriesKey`のシリーズにある`report`の`findingList`へ移す。`findingList`以外のフィールドは触らない。
 *
 * @param client クライアント。
 * @param seriesKey `data/index.json`の`seriesKey`。
 * @param textList 総評本文（`finding_texts.json`と同じ形）。
 * @returns 書き込んだコンテンツと件数。
 * @throws スコープのキーが`all`・数字のどちらでもない、4観点の見出し・段落が欠けている、シリーズが無い、
 *   またはそのスコープの`report`がシリーズに無ければ止める。
 */
export async function importFindings(
  client: ReportCmsClient,
  seriesKey: string,
  textList: FindingTexts
): Promise<ImportFindingsResult> {
  const keyList = Object.keys(textList)
  for (const key of keyList) {
    ensure(key === 'all' || /^\d+$/.test(key), `unknown scope key in the findings file: '${key}'`)
    for (const axis of FINDING_AXIS_LIST) {
      const entry = textList[key][axis]
      ensure(
        entry !== undefined && entry.heading !== undefined && entry.paragraphList !== undefined,
        `missing heading/paragraphList for '${key}'/'${axis}' in the findings file`
      )
    }
  }

  const series = await requireSeries(client, seriesKey)
  const byScope = await reportByScope(client, series.id)

  const ordered = [...keyList].sort((a, b) => scopeOrder(a) - scopeOrder(b))
  const reportList: ImportFindingsResult['reportList'] = []
  for (const key of ordered) {
    const scope = key === 'all' ? TOTAL_SCOPE : key
    const existing = byScope.get(scope)
    ensure(
      existing !== undefined,
      `${REPORT_ENDPOINT}: series '${seriesKey}' has no scope '${scope}'`
    )
    const findingList: FindingEntry[] = FINDING_AXIS_LIST.map(axis => {
      const entry = textList[key][axis]
      const evidence = entry.evidence ?? []
      return {
        fieldId: 'finding',
        axis: [axis],
        heading: entry.heading,
        paragraphList: entry.paragraphList.join('\n'),
        evidenceItemList: evidence.flatMap(item => item.itemList ?? []).join('\n'),
        evidenceExemplarList: evidence.flatMap(item => item.exemplarList ?? []).join('\n'),
      }
    })
    await client.update({
      endpoint: REPORT_ENDPOINT,
      contentId: existing.id,
      content: { findingList },
    })
    reportList.push({ scope, findings: findingList.length })
  }
  return { reportList }
}

/**
 * 総評本文のスコープキーの並び順。全体スコープを先頭にし、残りはスコープid昇順にする。
 *
 * @param key `all`または`0`〜`9`。
 * @returns 並べ替えに使う数値。
 */
function scopeOrder(key: string): number {
  return key === 'all' ? -1 : Number(key)
}
