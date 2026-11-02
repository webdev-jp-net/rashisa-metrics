import styles from './NumberBadge.module.scss'

export interface NumberBadgeProps {
  value: number
  /** 呼び出し元でバッジの色を上書きできるようにする（再測定テーブルはこれを使って色を継承する）。 */
  className?: string
}

/**
 * 数値のバッジ表示。
 *
 * @param props
 * @param props.value 表示する数値。
 * @param props.className 追加するクラス名。
 * @returns 描画結果。
 */
export function NumberBadge({ value, className }: NumberBadgeProps) {
  return (
    <span className={className ? `${styles.badge} ${className}` : styles.badge}>
      {String(value).padStart(2, '0')}
    </span>
  )
}
