import { getValue } from './metric-specs'
import type { Budget, ChapterMeasurement, MetricSpec } from './types'

/**
 * agentの探索の目安。比率・密度系は現在の分母のままお手本媒体の値に届く分子を示し、分布系（文・段落長）はカウントを持たないためnull。採用量は再測定で決めるので目安に過ぎない。
 *
 * @param spec 指標の仕様（id・path・scale・お手本の値）。
 * @param details 現在のスコープ本文の計測結果と分子・分母。
 * @returns 目安。
 */
export function budget(
  spec: Pick<MetricSpec, 'id' | 'path' | 'scale' | 'model'>,
  details: ChapterMeasurement
): Budget {
  const current = getValue(details.profile, spec)
  const gap = spec.model - current
  const direction: Budget['direction'] =
    gap > 1e-12 ? 'increase' : gap < -1e-12 ? 'decrease' : 'none'

  const count = details.countList[spec.id]
  let numerator: number | null = null
  let denominator: number | null = null
  let estimated: number | null = null
  let target: number | null = null
  if (count !== undefined) {
    numerator = count.numerator
    denominator = count.denominator
    // 敬語系の指標は形態素1000語あたりの値、それ以外のカウント系指標は百分率。
    const densityScale = spec.id.startsWith('politeness.') ? 1000 : 100
    target = (spec.model * denominator) / densityScale
    estimated = target - numerator
  }

  return {
    current,
    model: spec.model,
    gap,
    direction,
    estimatedDeltaCount: estimated,
    targetCountAtCurrentDenominator: target,
    numerator,
    denominator,
  }
}
