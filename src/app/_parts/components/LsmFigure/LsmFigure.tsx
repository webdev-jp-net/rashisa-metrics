'use client'

import { formatFixed, formatGeneral } from '../../format'
import type { LsmFigureModel } from '../../model/types'
import { useInView } from '../../useReport'
import { DataTable } from '../DataTable'
import styles from './LsmFigure.module.scss'

/* SVGの座標定数（px）。図の配置はdesign-system.md「LSMスケールバー」に従う。 */
const LABEL_X = 8
const BAR_X = 96
const SCALE = 450
const VALUE_X = 558
const VIEW_WIDTH = 666
const GRID_TOP = 8
const AVERAGE_BAR_Y = 52
const AVERAGE_BAR_HEIGHT = 16
const CATEGORY_FIRST_Y = AVERAGE_BAR_Y + 48
const CATEGORY_ROW_HEIGHT = 32
const CATEGORY_BAR_HEIGHT = 12

/** 0.85は判定規則の`lsmSynchronyThreshold`（Pennebaker 2011）と同じ値。0.6の「通常」帯はデザイン仕様（design-system.md）で決めた表示上の区切り。 */
const TICK_LIST: [number, string, string | null][] = [
  [0, '0', '離れている'],
  [0.6, '0.6', '通常'],
  [0.85, '0.85', '近い'],
  [1, '1', null],
]

const ZONE_STYLE = {
  fontSize: '10px',
  fill: 'var(--series-a)',
  fontFamily: 'var(--font-mono),var(--font-body)',
}

const AVERAGE_STYLE = {
  fontSize: 'var(--t-h3)',
  fontWeight: 700,
  fill: 'var(--ink-1)',
  fontFamily: 'var(--font-mono),var(--font-body)',
}

/**
 * 0〜1の値をSVGのx座標にする。
 *
 * @param fraction 0〜1の値。
 * @returns x座標（px）。
 */
function tickX(fraction: number): number {
  return BAR_X + fraction * SCALE
}

export interface LsmFigureProps {
  figure: LsmFigureModel
}

/**
 * LSMの図。平均と10カテゴリの一致度を横棒で示し、判定規則の`lsmSynchronyThreshold`（0.85。これ以上を「高い同期性」とみなす）を帯で示す。
 *
 * @param props
 * @param props.figure LSM図の表示モデル。
 * @returns 描画結果。
 */
export function LsmFigure({ figure }: LsmFigureProps) {
  const { rowList, average, modelLabel, editedLabel } = figure
  const { ref, inView } = useInView<HTMLElement>()
  const gridBottom =
    CATEGORY_FIRST_Y + (rowList.length - 1) * CATEGORY_ROW_HEIGHT + CATEGORY_BAR_HEIGHT + 16
  const tickY = gridBottom + 16
  const viewHeight = tickY + 8
  const x06 = tickX(0.6)
  const x085 = tickX(0.85)
  const x1 = tickX(1)
  const bandHeight = gridBottom - GRID_TOP

  return (
    <figure ref={ref} className={`${styles.chart} ${inView ? styles.inView : ''}`}>
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
        role="img"
        aria-label="文法カテゴリ別のLSM。1に近いほど使用比率が近い"
      >
        <title>カテゴリ別LSM</title>
        <rect
          x={formatGeneral(x06)}
          y={GRID_TOP}
          width={formatGeneral(x085 - x06)}
          height={bandHeight}
          fill="var(--paper-sepia)"
          opacity="0.5"
        />
        <rect
          x={formatGeneral(x085)}
          y={GRID_TOP}
          width={formatGeneral(x1 - x085)}
          height={bandHeight}
          fill="oklch(88% 0.03 85)"
          opacity="0.5"
        />
        {TICK_LIST.map(([fraction, , zone]) => {
          const x = formatGeneral(tickX(fraction))
          return (
            <g key={`grid-${fraction}`}>
              <line x1={x} x2={x} y1={GRID_TOP} y2={gridBottom} stroke="var(--rule)" />
              {zone ? (
                <text x={formatGeneral(tickX(fraction) + 8)} y={28} style={ZONE_STYLE}>
                  {zone}
                </text>
              ) : null}
            </g>
          )
        })}
        <text x={LABEL_X} y={formatFixed(AVERAGE_BAR_Y + 13, 0)} className="label" fontWeight="700">
          平均値
        </text>
        <rect
          className="bar"
          x={BAR_X}
          y={formatFixed(AVERAGE_BAR_Y, 2)}
          width={(average * SCALE).toFixed(4)}
          height={AVERAGE_BAR_HEIGHT}
          rx="0"
          fill="var(--ink-2)"
        />
        <text x={VALUE_X} y={formatFixed(AVERAGE_BAR_Y + 15, 0)} style={AVERAGE_STYLE}>
          {formatFixed(average, 3)}
        </text>
        {rowList.map((row, index) => {
          const y = CATEGORY_FIRST_Y + index * CATEGORY_ROW_HEIGHT
          const textY = formatFixed(y + 9, 0)
          return (
            <g key={row.label}>
              <text x={LABEL_X} y={textY} className="label">
                {row.label}
              </text>
              <rect
                className="bar"
                x={BAR_X}
                y={formatFixed(y, 2)}
                width={(row.lsm * SCALE).toFixed(4)}
                height={CATEGORY_BAR_HEIGHT}
                rx="0"
                fill="color-mix(in oklch, var(--ink-2) 50%, transparent)"
              />
              <text x={VALUE_X} y={textY} className="value">
                {formatFixed(row.lsm, 3)}
              </text>
            </g>
          )
        })}
        <line
          x1={BAR_X}
          x2={formatGeneral(x1)}
          y1={gridBottom}
          y2={gridBottom}
          stroke="var(--rule)"
        />
        {TICK_LIST.map(([fraction, label]) => (
          <text
            key={`tick-${fraction}`}
            x={formatGeneral(tickX(fraction))}
            y={tickY}
            textAnchor="middle"
            className="tick"
            style={{ fill: 'var(--series-a)' }}
          >
            {label}
          </text>
        ))}
      </svg>
      <details>
        <summary>カテゴリ別の内訳</summary>
        <DataTable
          headerList={['', `${modelLabel}の比率`, `${editedLabel}の比率`, 'LSM']}
          rowList={rowList.map(row => [
            row.label,
            `${formatFixed(row.model * 100, 3)}%`,
            `${formatFixed(row.edited * 100, 3)}%`,
            formatFixed(row.lsm, 3),
          ])}
        />
      </details>
    </figure>
  )
}
