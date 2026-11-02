import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { createReportClient, getReportList, getSeriesByKey } from '@/lib/api/microcms'
import { authOption } from '@/lib/auth'
import { isAllowedViewer } from '@/lib/permission'
import { LoginPrompt } from '../_parts/components/LoginPrompt'
import { ReportView } from '../_parts/view'
import { buildReportModel } from '../_parts/model'

/** リクエストのたびにmicroCMSを読み直す。ビルド時に事前レンダリングはしない。 */
export const dynamic = 'force-dynamic'

/**
 * パスの`seriesKey`として受け付ける文字。microCMSの`filters`に埋め込むため、`[`・`]`等の
 * 演算子を組み立てられる文字を通さない。
 */
const SERIES_KEY_PATTERN = /^[A-Za-z0-9_-]+$/

/** このページが受け取るパス。 */
interface SeriesPageProps {
  params: Promise<{ seriesKey: string }>
}

/**
 * パスの`seriesKey`のシリーズを引く。受け付けない文字を含む、またはmicroCMSに無ければ404にする。
 *
 * @param seriesKey パスの`seriesKey`。
 * @returns クライアントと、該当するシリーズ。
 */
async function loadSeries(seriesKey: string) {
  if (!SERIES_KEY_PATTERN.test(seriesKey)) notFound()
  const client = createReportClient()
  const series = await getSeriesByKey(client, seriesKey)
  if (!series) notFound()
  return { client, series }
}

/**
 * タイトルはパスのシリーズの`siteTitle`。
 *
 * @param props
 * @param props.params パスの`seriesKey`。
 * @returns Next.jsのメタデータ。
 */
export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const { series } = await loadSeries((await params).seriesKey)
  return { title: series.siteTitle }
}

/**
 * Server Component。取得と表示モデルの組み立てはここ（サーバー側）で済ませ、クライアントには結果だけ渡す。
 * APIキーを持つクライアントはこの中だけに置く。パスのシリーズの許可リストで判定を先に済ませ、
 * 通らない閲覧者にはレポートの材料（`getReportList`）を取りにいかない。
 *
 * @param props
 * @param props.params パスの`seriesKey`。
 * @returns 描画結果。許可された閲覧者にはそのシリーズのレポート、それ以外にはログイン促し画面。
 */
export default async function SeriesPage({ params }: SeriesPageProps) {
  const [session, { client, series }] = await Promise.all([
    getServerSession(authOption),
    params.then(({ seriesKey }) => loadSeries(seriesKey)),
  ])

  if (!isAllowedViewer(session, series.allowList)) {
    return (
      <LoginPrompt
        state={session ? 'notAllowed' : 'signedOut'}
        siteTitle={series.siteTitle}
        siteLead={series.siteLead}
      />
    )
  }

  const reportList = await getReportList(client, series.id)
  return <ReportView model={buildReportModel(series, reportList)} isSignedIn={session !== null} />
}
