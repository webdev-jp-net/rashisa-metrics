'use client'

import { Fragment } from 'react'
import type { TotalProposalModel } from '../../model/types'
import { ComparisonTable } from '../ComparisonTable'
import styles from './TotalProposal.module.scss'

export interface TotalProposalProps {
  proposal: TotalProposalModel
  filter: string
  onFilterChange: (view: string) => void
  onScopeSelect: (scopeKey: string) => void
}

/**
 * 全体スコープの総括。一覧表と、全体行で基準超過した項目ごとの調整文。
 *
 * @param props
 * @param props.proposal 総括の表示モデル。
 * @param props.filter 列フィルタの選択値。
 * @param props.onFilterChange 列フィルタの変更。
 * @param props.onScopeSelect 行ラベルのクリック。
 * @returns 描画結果。
 */
export function TotalProposal({
  proposal,
  filter,
  onFilterChange,
  onScopeSelect,
}: TotalProposalProps) {
  return (
    <div className={styles.proposal}>
      <div className={styles.summary}>
        <p>{proposal.leadText}</p>
        <p>{proposal.overallText}</p>
        <p>
          {proposal.rangeLineList.map((line, index) => (
            <Fragment key={index}>
              {line}
              {index < proposal.rangeLineList.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      </div>
      <div className={styles.suggestions}>
        <p className={styles.label} id="summary-suggestions-label">
          {proposal.suggestionListLabel}
        </p>
        <ul className={styles.list} aria-labelledby="summary-suggestions-label">
          {proposal.suggestionList.map(suggestion => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ul>
      </div>
      <ComparisonTable
        table={proposal.table}
        filter={filter}
        onFilterChange={onFilterChange}
        onScopeSelect={onScopeSelect}
      />
    </div>
  )
}
