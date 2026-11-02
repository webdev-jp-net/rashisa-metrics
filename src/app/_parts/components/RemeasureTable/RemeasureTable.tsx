import type { MetricListGroup, MetricValue } from '../../model/types'
import { Icon } from '../Icon'
import { NumberBadge } from '../NumberBadge'
import styles from './RemeasureTable.module.scss'

/**
 * 値と単位。単位だけ小さく出す。
 *
 * @param props
 * @param props.value 書式化済みの値と単位。
 * @returns 描画結果。
 */
function Value({ value }: { value: MetricValue }) {
  return (
    <>
      {value.value}
      <span className={styles.unit}>{value.unit}</span>
    </>
  )
}

export interface RemeasureTableProps {
  groupList: MetricListGroup[]
  modelHeader: string
  regionLabel: string
}

/**
 * 再測定テーブル。変更案の対象指標について、お手本・適用前・適用後の値と差の動きを観点ごとに出す。
 *
 * @param props
 * @param props.groups 観点ごとの行。
 * @param props.modelHeader お手本列の見出し。
 * @param props.regionLabel 表のアクセシブルな名前。
 * @returns 描画結果。
 */
export function RemeasureTable({ groupList, modelHeader, regionLabel }: RemeasureTableProps) {
  return (
    <div className={styles.scroll} role="region" aria-label={regionLabel} tabIndex={0}>
      <table className={styles.metrics}>
        <colgroup>
          <col className={styles.colGenre} />
          <col className={styles.colItem} />
          <col />
          <col />
          <col />
          <col className={styles.colModel} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col" />
            <th scope="col">既存テキスト</th>
            <th scope="col">
              <Icon name="arrow-right" weight="regular" />
            </th>
            <th scope="col">調整提案</th>
            <th scope="col">{modelHeader}</th>
          </tr>
        </thead>
        <tbody>
          {groupList.map(group =>
            group.entryList.map((entry, index) => (
              <tr key={`${group.genre}-${entry.item}`}>
                {index === 0 ? (
                  <th scope="row" className={styles.colGenre} rowSpan={group.entryList.length}>
                    <NumberBadge value={group.badge} className={styles.genreBadge} />
                    {group.heading}
                  </th>
                ) : null}
                <th scope="row" className={styles.colItem}>
                  {entry.item}
                </th>
                <td>
                  <Value value={entry.before} />
                </td>
                <td className={styles.arrow} aria-hidden="true">
                  {entry.direction === 'plus' ? <Icon name="plus" weight="regular" /> : null}
                  {entry.direction === 'minus' ? <Icon name="minus" weight="regular" /> : null}
                </td>
                <td>
                  <Value value={entry.after} />
                </td>
                <td className={styles.colModel}>
                  <Value value={entry.model} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
