'use client'

import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import type { AnalysisModel, ViewpointDefinition, ViewpointKey } from '../../model/types'
import { useTabPanel } from '../../useReport'
import { FindingText } from '../FindingText'
import { LsmFigure } from '../LsmFigure'
import { NumberBadge } from '../NumberBadge'
import { PairChart } from '../PairChart'
import styles from './AnalysisPanel.module.scss'

interface AxisPanelProps {
  id: string
  selected: boolean
  onFound: () => void
  children: ReactNode
}

/**
 * 観点1つ分のタブパネル。非表示でも`hidden="until-found"`でDOMに残し、ページ内検索で見つかったら選択する。
 *
 * @param props
 * @param props.id パネルのDOM id。対応するタブは`tab-{id}`。
 * @param props.selected 選択中か。
 * @param props.onFound ページ内検索でこのパネルが見つかったときの通知。
 * @param props.children パネルの中身。
 * @returns 描画結果。
 */
function AxisPanel({ id, selected, onFound, children }: AxisPanelProps) {
  const ref = useTabPanel(selected, onFound)
  return (
    <section
      ref={ref as RefObject<HTMLElement | null>}
      id={id}
      role="tabpanel"
      className={styles.axisPanel}
      aria-labelledby={`tab-${id}`}
      hidden={!selected}
    >
      <div className={styles.axisContent}>{children}</div>
    </section>
  )
}

export interface AnalysisPanelProps {
  title: string
  scopeKey: string
  analysis: AnalysisModel
  viewpointList: ViewpointDefinition[]
  selected: ViewpointKey
  onSelect: (viewpoint: ViewpointKey) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, viewpoint: ViewpointKey) => void
  tabRefList: RefObject<Record<string, HTMLButtonElement | null>>
}

/**
 * 分析パネル。4観点のタブと、選択中の観点の図表・総評。
 *
 * @param props
 * @param props.title パネルの見出し。
 * @param props.scopeKey スコープの`key`。DOM idの一部。
 * @param props.analysis 4観点の図表と総評。
 * @param props.viewpoints 観点タブの定義。
 * @param props.selected 選択中の観点。
 * @param props.onSelect 観点タブのクリック。
 * @param props.onKeyDown 観点タブのキー操作。
 * @param props.tabRefs 観点タブのボタン要素。矢印キー移動でフォーカスするため。
 * @returns 描画結果。
 */
export function AnalysisPanel({
  title,
  scopeKey,
  analysis,
  viewpointList,
  selected,
  onSelect,
  onKeyDown,
  tabRefList,
}: AnalysisPanelProps) {
  const bodyList: Record<ViewpointKey, ReactNode> = {
    lsm: (
      <>
        <LsmFigure figure={analysis.lsm.figure} />
        <FindingText finding={analysis.lsm.finding} />
      </>
    ),
    endings: (
      <>
        <PairChart chart={analysis.endings.chart} />
        <FindingText finding={analysis.endings.finding} />
      </>
    ),
    politeness: (
      <>
        <PairChart chart={analysis.politeness.chart} />
        <FindingText finding={analysis.politeness.finding} />
      </>
    ),
    length: (
      <>
        {analysis.length.chartList.map(chart => (
          <PairChart key={chart.title} chart={chart} />
        ))}
        <FindingText finding={analysis.length.finding} />
      </>
    ),
  }

  return (
    <>
      <h2 className={styles.analysisTitle}>{title}</h2>
      <div className={styles.tabs} role="tablist" aria-label="観点">
        {viewpointList.map((viewpoint, index) => {
          const id = `report-${scopeKey}-${viewpoint.key}`
          return (
            <button
              key={viewpoint.key}
              ref={element => {
                tabRefList.current[`${scopeKey}-${viewpoint.key}`] = element
              }}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-controls={id}
              aria-selected={viewpoint.key === selected}
              tabIndex={viewpoint.key === selected ? 0 : -1}
              onClick={() => onSelect(viewpoint.key)}
              onKeyDown={event => onKeyDown(event, viewpoint.key)}
            >
              <NumberBadge value={index + 1} />
              {viewpoint.tabLabel}
            </button>
          )
        })}
      </div>
      <div>
        <div className={styles.axisViewBody}>
          {viewpointList.map(viewpoint => (
            <AxisPanel
              key={viewpoint.key}
              id={`report-${scopeKey}-${viewpoint.key}`}
              selected={viewpoint.key === selected}
              onFound={() => onSelect(viewpoint.key)}
            >
              {bodyList[viewpoint.key]}
            </AxisPanel>
          ))}
        </div>
      </div>
    </>
  )
}
