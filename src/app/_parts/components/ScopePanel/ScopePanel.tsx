'use client'

import type { KeyboardEvent, RefObject } from 'react'
import type { ReportModel, ScopeModel, ViewpointKey } from '../../model/types'
import { useTabPanel } from '../../useReport'
import { AnalysisPanel } from '../AnalysisPanel'
import { ProposalPanel } from '../ProposalPanel'
import styles from './ScopePanel.module.scss'

export interface ScopePanelProps {
  scope: ScopeModel
  selected: boolean
  analysisTitle: string
  viewpointList: ReportModel['viewpointList']
  modelLabel: string
  viewpoint: ViewpointKey
  filter: string
  viewpointTabRefList: RefObject<Record<string, HTMLButtonElement | null>>
  onFound: () => void
  onViewpointSelect: (viewpoint: ViewpointKey) => void
  onViewpointKeyDown: (event: KeyboardEvent<HTMLButtonElement>, viewpoint: ViewpointKey) => void
  onFilterChange: (view: string) => void
  onScopeSelect: (scopeKey: string) => void
}

/**
 * スコープ1つ分のタブパネル。変更案パネルと分析パネルを持つ。
 *
 * @param props
 * @param props.scope スコープの表示モデル。
 * @param props.selected 選択中か。
 * @param props.analysisTitle 分析パネルの見出し。
 * @param props.viewpoints 観点タブの定義。
 * @param props.modelLabel お手本媒体の表示名。
 * @param props.viewpoint このスコープで選択中の観点。
 * @param props.filter 一覧表の列フィルタの選択値。
 * @param props.viewpointTabRefs 観点タブのボタン要素。
 * @param props.onFound ページ内検索でこのパネルが見つかったときの通知。
 * @param props.onViewpointSelect 観点タブのクリック。
 * @param props.onViewpointKeyDown 観点タブのキー操作。
 * @param props.onFilterChange 列フィルタの変更。
 * @param props.onScopeSelect 一覧表の行ラベルのクリック。
 * @returns 描画結果。
 */
export function ScopePanel({
  scope,
  selected,
  analysisTitle,
  viewpointList,
  modelLabel,
  viewpoint,
  filter,
  viewpointTabRefList,
  onFound,
  onViewpointSelect,
  onViewpointKeyDown,
  onFilterChange,
  onScopeSelect,
}: ScopePanelProps) {
  const ref = useTabPanel(selected, onFound)
  return (
    <section
      ref={ref as RefObject<HTMLElement | null>}
      id={scope.panelId}
      role="tabpanel"
      className={styles.panel}
      aria-labelledby={`tab-${scope.panelId}`}
      hidden={!selected}
    >
      <article className={styles.body}>
        <ProposalPanel
          proposal={scope.proposal}
          modelLabel={modelLabel}
          filter={filter}
          onFilterChange={onFilterChange}
          onScopeSelect={onScopeSelect}
        />
        <hr />
        <div className={styles.analysis}>
          <AnalysisPanel
            title={analysisTitle}
            scopeKey={scope.key}
            analysis={scope.analysis}
            viewpointList={viewpointList}
            selected={viewpoint}
            onSelect={onViewpointSelect}
            onKeyDown={onViewpointKeyDown}
            tabRefList={viewpointTabRefList}
          />
        </div>
      </article>
    </section>
  )
}
