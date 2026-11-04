'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import styles from './SeriesIndex.module.scss'
import { useSeriesIndex } from './useSeriesIndex'

/** レポートの一覧の見出しのid。一覧のまとまり（`section`）の名前として参照する。 */
const REPORT_HEADING_ID = 'series-index-report-heading'

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
 * その下に閲覧できるシリーズへのリンクの一覧を小見出し付きで（無ければ出さない）、続けて注釈と、
 * 未ログインならログイン、ログイン済みならログアウトのボタンを出す。
 *
 * @param props
 * @param props.isSignedIn ログインしているか。
 * @param props.seriesList 閲覧できるシリーズ。
 * @returns 描画結果。
 */
export function SeriesIndex({ isSignedIn, seriesList }: SeriesIndexProps) {
  const { title, lead, paragraphLineList, reportHeading, authNote, handleSignIn, handleSignOut } =
    useSeriesIndex()

  return (
    <main>
      <div className={styles.box}>
        <div className={styles.copy}>
          <header>
            <h1>{title}</h1>
            <p className={styles.lead}>{lead}</p>
          </header>
          <p>
            {paragraphLineList.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {line}
                {lineIndex < paragraphLineList.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        </div>
        {seriesList.length > 0 && (
          <section className={styles.reports} aria-labelledby={REPORT_HEADING_ID}>
            <h2 id={REPORT_HEADING_ID} className={styles.heading}>
              {reportHeading}
            </h2>
            <ul className={styles.list}>
              {seriesList.map(series => (
                <li key={series.seriesKey}>
                  <Link href={`/${series.seriesKey}`}>{series.siteTitle}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className={styles.auth}>
          <p className={styles.note}>{authNote}</p>
          {isSignedIn ? (
            <button type="button" className={styles.button} onClick={handleSignOut}>
              ログアウトする
            </button>
          ) : (
            <button type="button" className={styles.button} onClick={handleSignIn}>
              ログインする
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
