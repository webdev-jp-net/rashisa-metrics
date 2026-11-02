import { Fragment } from 'react'
import type { ReportModel } from '../../model/types'
import styles from './HeroSection.module.scss'

/** 手書き風リンク（`.hint`）の書体。design-system.md「書体」の手書き風書体と同じスタック。 */
const HINT_FONT = { fontFamily: "'Zen Kurenaido',var(--font-head)" }

export interface HeroSectionProps {
  site: ReportModel['site']
  hero: ReportModel['hero']
}

/**
 * 最初の画面。タイトル・リード文・目的の説明と、次の画面へのリンク。
 *
 * @param props
 * @param props.site タイトルとリード文。
 * @param props.hero 目的の説明とリンク文言。
 * @returns 描画結果。
 */
export function HeroSection({ site, hero }: HeroSectionProps) {
  return (
    <div className={styles.box}>
      <div className={styles.copy}>
        <header>
          <h1>{site.title}</h1>
          <p className={styles.lead}>{site.lead}</p>
        </header>
        <p>
          {hero.paragraphLineList.map((line, index) => (
            <Fragment key={index}>
              {line}
              {index < hero.paragraphLineList.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      </div>
      <a href="#analysis-intro" className={styles.hint} style={HINT_FONT}>
        <span>{hero.hintLabel}</span>
      </a>
    </div>
  )
}
