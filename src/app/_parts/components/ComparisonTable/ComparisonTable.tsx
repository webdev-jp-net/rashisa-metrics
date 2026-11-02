'use client'

import { NumberBadge } from '../NumberBadge'
import type { ComparisonTableModel } from '../../model/types'
import styles from './ComparisonTable.module.scss'

/**
 * フィルタ（主要項目・全項目・観点別）で列を出すか。
 *
 * @param view フィルタの選択値。
 * @param displayGroup 列の表示群。
 * @param main 主要項目か。
 * @returns 表示するならtrue。
 */
function isVisible(view: string, displayGroup: string, main: boolean): boolean {
  if (view === 'all') return true
  if (view === 'main') return main
  if (view === 'length') return displayGroup === '文長' || displayGroup === '段落長'
  return view === displayGroup
}

export interface ComparisonTableProps {
  table: ComparisonTableModel
  filter: string
  onFilterChange: (view: string) => void
  onScopeSelect: (scopeKey: string) => void
}

/**
 * 一覧表。全スコープ×28列（26指標＋LSM平均＋参考値の敬語合計）の差分と強調。行のラベルからスコープへ移動できる。
 *
 * @param props
 * @param props.table 一覧表の表示モデル。
 * @param props.filter 列フィルタの選択値。
 * @param props.onFilterChange 列フィルタの変更。
 * @param props.onScopeSelect 行ラベルのクリック（スコープへ移動）。
 * @returns 描画結果。
 */
export function ComparisonTable({
  table,
  filter,
  onFilterChange,
  onScopeSelect,
}: ComparisonTableProps) {
  return (
    <section className={styles.evidence}>
      <div className={styles.controls} aria-label="表示項目">
        {table.filterList.map(entry => (
          <button
            key={entry.view}
            type="button"
            aria-pressed={entry.view === filter}
            onClick={() => onFilterChange(entry.view)}
          >
            {entry.badge ? <NumberBadge value={entry.badge} /> : null}
            {entry.label}
          </button>
        ))}
      </div>
      <div className={styles.wrap} role="region" aria-label={table.regionLabel} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col" className={styles.name} />
              <th scope="col" className={styles.diffcount}>
                差のある指標
              </th>
              <th scope="col" className={styles.size}>
                文字数
              </th>
              {table.columnList.map(column => (
                <th
                  key={`${column.group}-${column.item}`}
                  scope="col"
                  data-group={column.displayGroup}
                  data-main={String(column.main)}
                  hidden={!isVisible(filter, column.displayGroup, column.main)}
                >
                  <span>{column.displayGroup}</span>
                  {column.item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rowList.map(row => (
              <tr key={row.scopeKey}>
                <th scope="row" className={styles.name}>
                  <button
                    type="button"
                    className={styles.scopeLink}
                    onClick={() => onScopeSelect(row.scopeKey)}
                  >
                    {row.label}
                  </button>
                </th>
                <td title={row.countTitle} className={styles.diffcount}>
                  <strong>{row.count}</strong> / {table.denominator}
                </td>
                <td className={styles.size}>{row.chars}</td>
                {row.cellList.map((cell, index) => (
                  <td
                    key={index}
                    title={cell.title}
                    className={
                      cell.standout ? `${styles.neutral} ${styles.standout}` : styles.neutral
                    }
                    data-group={cell.displayGroup}
                    data-main={String(cell.main)}
                    hidden={!isVisible(filter, cell.displayGroup, cell.main)}
                  >
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.hints}>
        {table.hintList.map((hint, index) => (
          <p key={index} className={styles.hint}>
            {hint}
          </p>
        ))}
      </div>
    </section>
  )
}
