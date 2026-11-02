'use client'

import { formatGeneral, formatShort } from '../../format'
import type { PairChartModel } from '../../model/types'
import { useInView } from '../../useReport'
import styles from './PairChart.module.scss'

/** 系列aがお手本媒体、系列bが編集対象媒体。この順序は変えない。 */
const SERIES_FILL = ['var(--series-a)', 'var(--series-b)'] as const

/* SVGの座標定数（px）。図の配置はdesign-system.md「ペア棒グラフ」に従う。 */
const LABEL_X = 8
const BAR_X = 112
const SPAN = 468
const BAR_HEIGHT = 16
const BAR_GAP = 8
const ROW_HEIGHT = 64
const GRID_RIGHT = BAR_X + SPAN
const VALUE_X = GRID_RIGHT + 18
const VIEW_WIDTH = 740
const GRID_TOP = 0
const TICK_FRACTION_LIST = [0, 0.25, 0.5, 0.75, 1]

export interface PairChartProps {
  chart: PairChartModel
}

/**
 * お手本と編集対象を並べた横棒グラフ。文末表現・敬語密度・長さの観点で使う。
 *
 * @param props
 * @param props.chart ペア棒グラフの表示モデル。
 * @returns 描画結果。
 * @throws 値が0〜`maximum`の外なら止める。
 */
export function PairChart({ chart }: PairChartProps) {
  const { title, rowList, maximum, unit, seriesList, chartLabel } = chart
  const { ref, inView } = useInView<HTMLElement>()
  const gridBottom = 24 + 2 * BAR_HEIGHT + BAR_GAP + 24 + (rowList.length - 1) * ROW_HEIGHT
  const tickY = gridBottom + 16
  const viewHeight = tickY + 8

  return (
    <figure ref={ref} className={`${styles.chart} ${inView ? styles.inView : ''}`}>
      {chartLabel ? <figcaption className={styles.caption}>{chartLabel}</figcaption> : null}
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`} role="img" aria-label={title}>
        <title>{title}</title>
        {TICK_FRACTION_LIST.map(fraction => {
          const x = formatGeneral(BAR_X + fraction * SPAN)
          return (
            <line
              key={`grid-${fraction}`}
              x1={x}
              x2={x}
              y1={GRID_TOP}
              y2={gridBottom}
              stroke="var(--rule)"
            />
          )
        })}
        {rowList.map(([label, a, b], index) => {
          const y = 24 + index * ROW_HEIGHT
          return (
            <g key={label}>
              <text x={LABEL_X} y={y + 29} className="label">
                {label}
              </text>
              {[a, b].map((value, seriesIndex) => {
                if (value < 0 || value > maximum) {
                  throw new Error(`pair chart '${title}': ${value} is outside 0..${maximum}`)
                }
                const barY = y + seriesIndex * (BAR_HEIGHT + BAR_GAP)
                return (
                  <g key={seriesIndex}>
                    <rect
                      className="bar"
                      x={BAR_X}
                      y={barY}
                      width={((SPAN * value) / maximum).toFixed(4)}
                      height={BAR_HEIGHT}
                      rx="0"
                      fill={SERIES_FILL[seriesIndex]}
                    />
                    <text x={VALUE_X} y={barY + 12} className="value">
                      {`${seriesList[seriesIndex]} ${formatShort(value)}${unit}`}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
        <line
          x1={BAR_X}
          x2={formatGeneral(GRID_RIGHT)}
          y1={gridBottom}
          y2={gridBottom}
          stroke="var(--rule)"
        />
        {TICK_FRACTION_LIST.map(fraction => (
          <text
            key={`tick-${fraction}`}
            x={formatGeneral(BAR_X + fraction * SPAN)}
            y={tickY}
            textAnchor="middle"
            className="tick"
            style={{ fill: 'var(--series-a)' }}
          >
            {`${formatShort(fraction * maximum)}${unit}`}
          </text>
        ))}
      </svg>
      <div className={styles.chips}>
        {seriesList.map((name, index) => (
          <span key={name} className={styles.chip}>
            <i className={`${styles.dot} ${index === 0 ? styles.a : styles.b}`} />
            {name}
          </span>
        ))}
      </div>
    </figure>
  )
}
