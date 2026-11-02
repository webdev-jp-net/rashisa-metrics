import type { ViewpointDefinition } from '../../model/types'
import styles from './ViewpointCard.module.scss'

export interface ViewpointCardProps {
  viewpoint: ViewpointDefinition
  /** 1始まり。 */
  index: number
}

/**
 * 観点1つの説明カード。
 *
 * @param props
 * @param props.viewpoint 観点の定義。
 * @param props.index 表示番号（1始まり）。
 * @returns 描画結果。
 */
export function ViewpointCard({ viewpoint, index }: ViewpointCardProps) {
  return (
    <div className={styles.card}>
      <h3>
        <span className={styles.num}>{String(index).padStart(2, '0')}</span>
        {viewpoint.name}
        {viewpoint.subtitle ? <span className={styles.subtitle}>{viewpoint.subtitle}</span> : null}
      </h3>
      <p>{viewpoint.text}</p>
      {viewpoint.example ? <p className={styles.example}>{viewpoint.example}</p> : null}
    </div>
  )
}
