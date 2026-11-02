/**
 * roundHalfEven must match Python's round(x, ndigits) exactly, including the classic cases
 * where naive "shift, round-half-up, unshift" rounding disagrees with Python because the
 * double's exact binary value is not actually on the decimal .5 boundary it appears to be.
 */
import { describe, expect, test } from 'bun:test'
import { roundHalfEven } from '../../../src/lib/metrics'

describe('roundHalfEven', () => {
  test('binary-exact ties resolve to even, matching Python round()', () => {
    // Python: round(0.5, 0) == 0.0, round(1.5, 0) == 2.0, round(2.5, 0) == 2.0
    expect(roundHalfEven(0.5, 0)).toBe(0)
    expect(roundHalfEven(1.5, 0)).toBe(2)
    expect(roundHalfEven(2.5, 0)).toBe(2)
  })

  test('a value that looks like a .5 boundary in decimal but is not one in binary rounds by its true value', () => {
    // 2.675 is actually 2.67499999999999982236431605997495353221893310546875 in binary;
    // Python: round(2.675, 2) == 2.67, not 2.68.
    expect(roundHalfEven(2.675, 2)).toBe(2.67)
  })

  test('matches Python round() for count/total ratios at 6, 3, and 2 decimals', () => {
    // Python: round(1/3, 6) == 0.333333; round(2/3, 6) == 0.666667
    expect(roundHalfEven(1 / 3, 6)).toBe(0.333333)
    expect(roundHalfEven(2 / 3, 6)).toBe(0.666667)
    // Python: round(155/59, 3) == 2.627
    expect(roundHalfEven(155 / 59, 3)).toBe(2.627)
    // Python: round(71 / 74, 2) == 0.96
    expect(roundHalfEven(71 / 74, 2)).toBe(0.96)
  })

  test('zero and negative values', () => {
    expect(roundHalfEven(0, 6)).toBe(0)
    expect(roundHalfEven(-0.125, 2)).toBe(-0.12) // ties to even: -0.12 is even at the 2nd digit
  })
})
