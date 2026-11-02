import {
  ArrowRightIcon,
  PlusIcon,
  MinusIcon,
  ArrowsInLineVerticalIcon,
  ArrowsOutLineVerticalIcon,
} from '@phosphor-icons/react/ssr'
import styles from './Icon.module.scss'

/**
 * Phosphor Icons（MIT）。lightは24px（LSM前後比較の矢印）でのみ使う。それより小さいとストロークが
 * 細すぎて読みにくくなるため、それ以外の用途はすべてregularの太さを使う。
 */
const LIGHT = {
  'arrow-right': ArrowRightIcon,
} as const

const REGULAR = {
  'arrow-right': ArrowRightIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  'arrows-in-line-vertical': ArrowsInLineVerticalIcon,
  'arrows-out-line-vertical': ArrowsOutLineVerticalIcon,
} as const

export type LightIconName = keyof typeof LIGHT
export type RegularIconName = keyof typeof REGULAR

export type IconProps =
  { name: LightIconName; weight?: 'light' } | { name: RegularIconName; weight: 'regular' }

/**
 * 名前で選ぶSVGアイコン。1em・currentColorにして、周囲のテキストのサイズと色を継承させる。
 *
 * @param props アイコン名と太さ。`light`は`LIGHT`にある名前だけ。
 * @returns SVG要素。
 */
export function Icon(props: IconProps) {
  const Component =
    props.weight === 'regular' ? REGULAR[props.name] : LIGHT[props.name as LightIconName]
  return <Component className={styles.icon} weight={props.weight ?? 'light'} aria-hidden="true" />
}
