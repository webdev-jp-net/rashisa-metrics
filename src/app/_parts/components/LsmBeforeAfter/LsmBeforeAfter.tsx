import type { LsmBeforeAfterModel } from '../../model/types'
import { Icon } from '../Icon'
import styles from './LsmBeforeAfter.module.scss'

export interface LsmBeforeAfterProps {
  lsm: LsmBeforeAfterModel
}

/**
 * 変更案適用前後の平均LSM。
 *
 * @param props
 * @param props.lsm 適用前後の平均LSM。
 * @returns 描画結果。
 */
export function LsmBeforeAfter({ lsm }: LsmBeforeAfterProps) {
  return (
    <dl className={styles.summary} aria-label="平均LSMの提案前後">
      <div className={`${styles.item} ${styles.before}`}>
        <dt>平均LSM</dt>
        <dd>{lsm.before}</dd>
      </div>
      <span className={styles.arrow} aria-hidden="true">
        <Icon name="arrow-right" />
      </span>
      <div className={`${styles.item} ${styles.after}`}>
        <dt>提案後 平均LSM</dt>
        <dd>{lsm.after}</dd>
      </div>
    </dl>
  )
}
