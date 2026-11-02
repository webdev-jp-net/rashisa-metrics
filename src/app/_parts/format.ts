/**
 * 画面に出す数値の書式化。固定小数点・一般表記とも偶数丸めで、doubleの正確な2進値から丸める。
 * `Number.prototype.toFixed`は端数ちょうど.5を0から遠い側へ丸めるため、同じ値でも最終桁が変わることがある。
 */
import { decomposeFloat } from '@/lib/metrics/round'

/**
 * `|x| * 10^digits`を偶数丸めで整数にする。doubleの正確な2進値から計算するので、10進表記の見かけの端数に惑わされない。
 *
 * @param x 値。
 * @param digits 小数点以下の桁数。
 * @returns 整数。
 */
function scaledRound(x: number, digits: number): bigint {
  const { mantissa, exponent } = decomposeFloat(Math.abs(x))
  const scale = 10n ** BigInt(digits)
  if (exponent >= 0n) return mantissa * (1n << exponent) * scale
  const denominator = 1n << -exponent
  const numerator = mantissa * scale
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  const twice = remainder * 2n
  if (twice > denominator) return quotient + 1n
  if (twice < denominator) return quotient
  return quotient % 2n === 0n ? quotient : quotient + 1n
}

/**
 * 整数に小数点を入れて固定小数点の文字列にする。
 *
 * @param scaled `scaledRound`の結果。
 * @param digits 小数点以下の桁数。
 * @returns 文字列。
 */
function withDecimalPoint(scaled: bigint, digits: number): string {
  const text = scaled.toString().padStart(digits + 1, '0')
  if (digits === 0) return text
  return `${text.slice(0, text.length - digits)}.${text.slice(text.length - digits)}`
}

/**
 * 小数点以下`digits`桁の固定小数点表記。-0は`-0.00`のように負号を保つ。
 *
 * @param value 値。
 * @param digits 小数点以下の桁数。
 * @returns 文字列。
 */
export function formatFixed(value: number, digits: number): string {
  const body = withDecimalPoint(scaledRound(value, digits), digits)
  const negative = value < 0 || Object.is(value, -0)
  return negative ? `-${body}` : body
}

/**
 * 符号付きの固定小数点表記（差分の表示用。正の値にも`+`を付ける）。
 *
 * @param value 値。
 * @param digits 小数点以下の桁数。
 * @returns 文字列。
 */
export function formatSigned(value: number, digits: number): string {
  const body = withDecimalPoint(scaledRound(value, digits), digits)
  return `${value < 0 ? '-' : '+'}${body}`
}

/**
 * 小数部の末尾の0と、不要になった小数点を落とす。
 *
 * @param text 固定小数点の文字列。
 * @returns 文字列。
 */
function stripTrailingZeros(text: string): string {
  if (!text.includes('.')) return text
  return text.replace(/0+$/, '').replace(/\.$/, '')
}

/**
 * 有効数字6桁の一般表記（範囲外は指数表記）。指標値の表示とSVG座標に使い、`String(number)`の長い桁をそのまま出さない。
 *
 * @param value 値。
 * @returns 文字列。有限でない値は`String(value)`。
 */
export function formatGeneral(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'
  const precision = 6
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  let exponent = Math.floor(Math.log10(absolute))
  // log10は10のべき乗の境界で1つずれることがあり、丸めによってさらに境界をまたぐこともある。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (exponent >= -4 && exponent < precision) {
      const digits = precision - 1 - exponent
      const scaled = scaledRound(absolute, digits)
      const rendered = withDecimalPoint(scaled, digits)
      const integerDigits = rendered.split('.')[0].replace(/^0+(?=\d)/, '').length
      const actual = rendered.startsWith('0.')
        ? -1 - /^0\.(0*)/.exec(rendered)![1].length
        : integerDigits - 1
      if (actual === exponent) return `${sign}${stripTrailingZeros(rendered)}`
      exponent = actual
      continue
    }
    const digits = precision - 1
    const shifted = absolute / 10 ** exponent
    const scaled = scaledRound(shifted, digits)
    const rendered = withDecimalPoint(scaled, digits)
    if (rendered.startsWith('10')) {
      exponent += 1
      continue
    }
    const mark = exponent < 0 ? '-' : '+'
    const power = String(Math.abs(exponent)).padStart(2, '0')
    return `${sign}${stripTrailingZeros(rendered)}e${mark}${power}`
  }
  return `${sign}${stripTrailingZeros(withDecimalPoint(scaledRound(absolute, precision - 1), precision - 1))}`
}

/**
 * 小数2桁で丸めて末尾の0を落とす。棒グラフの値ラベル・目盛用。
 *
 * @param value 値。
 * @returns 文字列。
 */
export function formatShort(value: number): string {
  return stripTrailingZeros(formatFixed(value, 2))
}

/**
 * 整数を3桁区切りにする。文字数の表示用。
 *
 * @param value 整数（小数部は切り捨て）。
 * @returns 文字列。
 */
export function formatThousands(value: number): string {
  const sign = value < 0 ? '-' : ''
  const digits = Math.abs(Math.trunc(value)).toString()
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
