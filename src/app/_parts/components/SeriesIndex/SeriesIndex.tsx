'use client'

import Link from 'next/link'
import styles from './SeriesIndex.module.scss'
import { useSeriesIndex } from './useSeriesIndex'

/** 手書き風リンク（`.hint`）の書体。design-system.md「書体」の手書き風書体と同じスタック。 */
const HINT_FONT = { fontFamily: "'Zen Kurenaido',var(--font-head)" }

/** ルートのリストに出す1シリーズ。 */
export interface SeriesLink {
  seriesKey: string
  siteTitle: string
}

export interface SeriesIndexProps {
  isSignedIn: boolean
  seriesList: SeriesLink[]
}

/**
 * ルート（`/`）の画面。`LoginPrompt`と同じ`.box`／`.copy`の構成でタイトル・リード文・段落を出し、
 * その下に閲覧できるシリーズへのリンクの一覧（無ければ出さない）、続けて未ログインならログイン、
 * ログイン済みならログアウトのボタンを出す。
 *
 * @param props
 * @param props.isSignedIn ログインしているか。
 * @param props.seriesList 閲覧できるシリーズ。
 * @returns 描画結果。
 */
export function SeriesIndex({ isSignedIn, seriesList }: SeriesIndexProps) {
  const { title, lead, paragraph, handleSignIn, handleSignOut } = useSeriesIndex()

  return (
    <main>
      <div className={styles.box}>
        <div className={styles.copy}>
          <header>
            <h1>{title}</h1>
            <p className={styles.lead}>{lead}</p>
          </header>
          <p>{paragraph}</p>
        </div>
        {seriesList.length > 0 && (
          <ul className={styles.list}>
            {seriesList.map(series => (
              <li key={series.seriesKey}>
                <Link href={`/${series.seriesKey}`}>{series.siteTitle}</Link>
              </li>
            ))}
          </ul>
        )}
        {isSignedIn ? (
          <button type="button" className={styles.hint} style={HINT_FONT} onClick={handleSignOut}>
            <span>ログアウトする</span>
          </button>
        ) : (
          <button type="button" className={styles.hint} style={HINT_FONT} onClick={handleSignIn}>
            <span>ログインする</span>
          </button>
        )}
      </div>
    </main>
  )
}
