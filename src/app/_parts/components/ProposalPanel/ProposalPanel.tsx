'use client'

import type { ProposalModel } from '../../model/types'
import { ScopeProposal } from '../ScopeProposal'
import { TotalProposal } from '../TotalProposal'

export interface ProposalPanelProps {
  proposal: ProposalModel | null
  modelLabel: string
  filter: string
  onFilterChange: (view: string) => void
  onScopeSelect: (scopeKey: string) => void
}

/**
 * 変更案パネル。全体スコープは総括、個別スコープはdiff提案を出す。公開済みの変更案が無いスコープは、空の枠を出さず何も描画しない。
 *
 * @param props
 * @param props.proposal 変更案パネルの表示モデル。無ければnull。
 * @param props.modelLabel お手本媒体の表示名。
 * @param props.filter 一覧表の列フィルタの選択値。
 * @param props.onFilterChange 列フィルタの変更。
 * @param props.onScopeSelect 一覧表の行ラベルのクリック。
 * @returns 描画結果。`proposal`がnullならnull。
 */
export function ProposalPanel({
  proposal,
  modelLabel,
  filter,
  onFilterChange,
  onScopeSelect,
}: ProposalPanelProps) {
  if (!proposal) return null
  if (proposal.kind === 'total') {
    return (
      <TotalProposal
        proposal={proposal}
        filter={filter}
        onFilterChange={onFilterChange}
        onScopeSelect={onScopeSelect}
      />
    )
  }
  return <ScopeProposal proposal={proposal} modelLabel={modelLabel} />
}
