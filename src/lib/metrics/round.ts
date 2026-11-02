/**
 * doubleを`x === mantissa * 2n**exponent`が成り立つ整数の組に正確に分解する。10進丸めの起点になる。
 *
 * @param x 非負の有限double。
 * @returns `mantissa`（非負整数）と`exponent`。
 */
export function decomposeFloat(x: number): { mantissa: bigint; exponent: bigint } {
  const buffer = new ArrayBuffer(8)
  new Float64Array(buffer)[0] = x
  const bits = new BigUint64Array(buffer)[0]!

  const rawExponent = Number((bits >> 52n) & 0x7ffn)
  const rawMantissa = bits & 0xfffffffffffffn

  if (rawExponent === 0) {
    // 非正規化数: value = mantissa * 2**-1074
    return { mantissa: rawMantissa, exponent: -1074n }
  }
  // 正規化数: value = (1.mantissa) * 2**(rawExponent-1023) = (2**52 + mantissa) * 2**(rawExponent-1075)
  return { mantissa: rawMantissa | 0x10000000000000n, exponent: BigInt(rawExponent) - 1075n }
}

/**
 * doubleの正確な2進数値を基準に、正しく丸めた10進丸めを行う。ここでのタイブレークは
 * 偶数丸め（round-half-to-even）。「10**nを掛けて0から遠い方向に丸め、10**nで割り戻す」
 * という方式は使わない——桁シフト後の値の正確な2進数値（あるいは浮動小数点数の10進表記）が
 * ちょうど.5の境界に乗ったときに結果がずれてしまい、これは件数／総数の比率を小数点2〜6桁に
 * 丸める場面でよく起きる。そこでこの実装は、IEEE-754 doubleをBigIntで正確な
 * `mantissa * 2**exponent`の値に分解し、`value * 10**ndigits`の正確な有理数を作り、
 * その有理数を偶数丸めで最も近い整数に丸める。
 *
 * @param value 丸める値。
 * @param ndigits 小数点以下の桁数。負なら10の位以上で丸める。
 * @returns 丸めた値。有限でない値と0はそのまま返す。
 */
export function roundHalfEven(value: number, ndigits: number): number {
  if (!Number.isFinite(value)) return value
  if (value === 0) return value

  const sign = value < 0 ? -1 : 1
  const magnitude = Math.abs(value)

  const { mantissa, exponent } = decomposeFloat(magnitude)
  if (mantissa === 0n) return value

  const nd = BigInt(ndigits)
  const tenPow = 10n ** (nd >= 0n ? nd : -nd)
  let numerator: bigint
  let denominator: bigint
  if (exponent >= 0n) {
    numerator = mantissa * 2n ** exponent * (nd >= 0n ? tenPow : 1n)
    denominator = nd >= 0n ? 1n : tenPow
  } else {
    numerator = mantissa * (nd >= 0n ? tenPow : 1n)
    denominator = 2n ** -exponent * (nd >= 0n ? 1n : tenPow)
  }

  let quotient = numerator / denominator
  const remainder = numerator % denominator
  const twiceRemainder = remainder * 2n
  if (twiceRemainder > denominator || (twiceRemainder === denominator && quotient % 2n !== 0n)) {
    quotient += 1n
  }

  const scale = 10 ** ndigits
  return (sign * Number(quotient)) / scale
}
