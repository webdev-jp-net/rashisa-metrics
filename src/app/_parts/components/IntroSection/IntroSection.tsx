import { Fragment } from 'react'
import type { ReportModel } from '../../model/types'
import { ViewpointCard } from '../ViewpointCard'
import styles from './IntroSection.module.scss'

/** 手書き風リンク（`.hint`）の書体。design-system.md「書体」の手書き風書体と同じスタック。 */
const HINT_FONT = { fontFamily: "'Zen Kurenaido',var(--font-head)" }

export interface IntroSectionProps {
  intro: ReportModel['intro']
  viewpointList: ReportModel['viewpointList']
}

/**
 * 解析方法の説明。4観点のカードを並べる。
 *
 * @param props
 * @param props.intro 解析方法の説明文。
 * @param props.viewpoints 4観点のカード定義。
 * @returns 描画結果。
 */
export function IntroSection({ intro, viewpointList }: IntroSectionProps) {
  return (
    <div className={styles.columns}>
      <div className={styles.copy}>
        <div className={styles.text}>
          {intro.paragraphList.map((lineList, paragraphIndex) => (
            <p key={paragraphIndex}>
              {lineList.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {line}
                  {lineIndex < lineList.length - 1 ? <br /> : null}
                </Fragment>
              ))}
            </p>
          ))}
        </div>
        <a href="#report-view" className={styles.hint} style={HINT_FONT}>
          <span>{intro.hintLabel}</span>
        </a>
      </div>
      <div className={styles.cards}>
        {viewpointList.map((viewpoint, index) => (
          <ViewpointCard key={viewpoint.key} viewpoint={viewpoint} index={index + 1} />
        ))}
      </div>
    </div>
  )
}
