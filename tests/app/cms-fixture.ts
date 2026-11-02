/**
 * @file 手元のファイルから、microCMSが返すのと同じ形の`series`・`report`を作る。`report`の組み立ては
 *   送信コマンドの関数（`buildReportContentList`・`importFindings`）に任せ、ここは管理画面が持つ日時・
 *   コンテンツIDを補うだけにする。`series`は送信コマンドが書かないので、表示名にプレースホルダーを入れて
 *   ここで作る。実際の通信は一切しない。
 */
import type { MicroCMSListResponse } from 'microcms-js-sdk'
import type {
  FindingEntry,
  ReportCmsClient,
  ReportContent,
  SeriesContent,
} from '@/lib/api/microcms'
import { MODEL_LABEL_PLACEHOLDER, scopeLabel, type ReportConfig } from '@/lib/config/report-config'
import { readJson } from '@/lib/data/json-io'
import { findingTextsPath, type FindingTexts } from '@/lib/data/report-data'
import { buildReportContentList, importFindings } from '../../scripts/cms-content'

/** 管理画面が付ける日時。画面はどれも読まないので固定値でよい。 */
const DATE_LIST = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-01-01T00:00:00.000Z',
  revisedAt: '2026-01-01T00:00:00.000Z',
}

/** 管理画面が自動発行するコンテンツID。画面はシリーズの`id`を`report`の絞り込みにしか使わない。 */
const SERIES_ID = 'series-fixture'

/**
 * 管理画面とエージェントが登録する`series`の代わり。表示名はmicroCMSのフィールドIDに合わせたプレースホルダー、
 * スコープ一覧はスコープと原稿ファイルの対応のid昇順。`allowList`は画面の判定より前で使うので含めない。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns `getSeriesByKey`が返すのと同じ形のシリーズ。
 */
function fixtureSeries(config: ReportConfig): SeriesContent {
  return {
    id: SERIES_ID,
    seriesKey: config.seriesKey,
    siteTitle: '{siteTitle}',
    siteLead: '{siteLead}',
    modelLabel: MODEL_LABEL_PLACEHOLDER,
    editedLabel: '{editedLabel}',
    scopeList: [...config.scopeList]
      .sort((a, b) => a.id - b.id)
      .map(scope => ({ fieldId: 'scope', scopeId: scope.id, label: scopeLabel(scope.id) })),
    ...DATE_LIST,
  }
}

/**
 * 総評本文を、`scope`ごとの`findingList`に変換する。取り込みコマンドと同じ変換を通すため、
 * シリーズと`report`の一覧を返し、書き込み内容を記録するだけのクライアントに`importFindings`を実行させる。
 *
 * @param series シリーズ（`seriesKey`で引かれる）。
 * @param reportList そのシリーズの`report`（`scope`で引かれる）。
 * @param textList 総評本文（`finding_texts.json`の内容）。
 * @returns `scope`ごとの`findingList`。
 */
async function findingListByScope(
  series: SeriesContent,
  reportList: ReportContent[],
  textList: FindingTexts
): Promise<Map<string, FindingEntry[]>> {
  const scopeById = new Map(reportList.map(report => [report.id, report.scope]))
  const recorded = new Map<string, FindingEntry[]>()
  const client: ReportCmsClient = {
    getList: async <T>(request: { endpoint: string }) => {
      const contents = request.endpoint === 'series' ? [series] : reportList
      return {
        contents,
        totalCount: contents.length,
        limit: contents.length,
        offset: 0,
      } as unknown as MicroCMSListResponse<T>
    },
    create: async request => ({ id: request.contentId ?? '' }),
    update: async request => {
      const scope = scopeById.get(request.contentId ?? '') ?? ''
      recorded.set(scope, request.content.findingList as FindingEntry[])
      return { id: request.contentId ?? '' }
    },
    delete: async () => {},
  }
  await importFindings(client, series.seriesKey, textList)
  return recorded
}

/**
 * 手元の実データから、`getSeriesByKey`が返す`series`と、`getReportList`が返す`report`と同じ形の値を作る。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns シリーズの内容と、全体スコープを先頭にした`report`の全コンテンツ。
 * @throws 原稿と公開済みの変更案が一致しない、または総評に欠けがあれば止める。
 */
export async function localCmsContents(
  config: ReportConfig
): Promise<{ series: SeriesContent; reportList: ReportContent[] }> {
  const series = fixtureSeries(config)
  const reference = { id: SERIES_ID, ...DATE_LIST }
  const bareList: ReportContent[] = buildReportContentList(config).map(content => ({
    id: `report-${content.scope}`,
    ...DATE_LIST,
    ...content.fields,
    series: reference,
    findingList: [],
  }))
  const findingList = await findingListByScope(
    series,
    bareList,
    readJson<FindingTexts>(findingTextsPath(config))
  )
  const reportList = bareList.map(report => ({
    ...report,
    findingList: findingList.get(report.scope) ?? [],
  }))
  return { series, reportList }
}
