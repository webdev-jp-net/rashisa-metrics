import { getServerSession } from 'next-auth'
import { createReportClient, getSeriesList } from '@/lib/api/microcms'
import { authOption } from '@/lib/auth'
import { isAllowedViewer } from '@/lib/permission'
import { SeriesIndex } from './_parts/components/SeriesIndex'

/** リクエストのたびにセッションとmicroCMSを読み直す。ビルド時に事前レンダリングはしない。 */
export const dynamic = 'force-dynamic'

/**
 * ルート（`/`）。その人が閲覧できるシリーズだけを一覧にする。未ログインなら許可リストが空のシリーズ、
 * ログインしていればそれに加えて許可リストにあるシリーズ。
 *
 * @returns 描画結果。
 */
export default async function RootPage() {
  const [session, allSeriesList] = await Promise.all([
    getServerSession(authOption),
    getSeriesList(createReportClient()),
  ])
  const seriesList = allSeriesList
    .filter(series => isAllowedViewer(session, series.allowList))
    .map(({ seriesKey, siteTitle }) => ({ seriesKey, siteTitle }))
  return <SeriesIndex isSignedIn={session !== null} seriesList={seriesList} />
}
