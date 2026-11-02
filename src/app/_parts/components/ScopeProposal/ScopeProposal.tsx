'use client'

import type { ScopeProposalModel } from '../../model/types'
import { DiffBox } from '../DiffBox'
import { LsmBeforeAfter } from '../LsmBeforeAfter'
import { RemeasureTable } from '../RemeasureTable'
import styles from './ScopeProposal.module.scss'

export interface ScopeProposalProps {
  proposal: ScopeProposalModel
  modelLabel: string
}

/**
 * 個別スコープの変更案。適用前後の平均LSM・再測定テーブル・diff提案。
 *
 * @param props
 * @param props.proposal 個別スコープの変更案の表示モデル。
 * @param props.modelLabel お手本媒体の表示名。
 * @returns 描画結果。
 */
export function ScopeProposal({ proposal, modelLabel }: ScopeProposalProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        <p>{proposal.lead}</p>
        <LsmBeforeAfter lsm={proposal.lsm} />
      </div>
      <RemeasureTable
        groupList={proposal.metricList}
        modelHeader={`参考とする${modelLabel}の指標`}
        regionLabel={`変更前後と${modelLabel}の計測値`}
      />
      <DiffBox diff={proposal.diff} />
    </div>
  )
}
