import { charOpcodeList } from './sequence-matcher'
import type { DiffSegment } from './types'

/**
 * 変更行1組の語diff（文字単位の差分を区間にまとめたもの）。
 * 変更の連続区間（run）に挟まれた1文字だけの'equal'区間（例: 「たくさん」→「多く」が「く」を共有する）は偶然の重なりであることが
 * 多いため、変更扱いにしてマークを途切れさせない。
 *
 * @param a 旧側の行。
 * @param b 新側の行。
 * @returns 両側の区間。
 */
export function wordDiff(a: string, b: string): { left: DiffSegment[]; right: DiffSegment[] } {
  const ac = Array.from(a)
  const bc = Array.from(b)
  const opcodeList = charOpcodeList(a, b)
  const left: DiffSegment[] = []
  const right: DiffSegment[] = []
  opcodeList.forEach((op, index) => {
    const incidental =
      op.tag === 'equal' &&
      op.i2 - op.i1 <= 1 &&
      index > 0 &&
      index < opcodeList.length - 1 &&
      opcodeList[index - 1].tag !== 'equal' &&
      opcodeList[index + 1].tag !== 'equal'
    const tag = incidental ? 'replace' : op.tag
    const av = ac.slice(op.i1, op.i2).join('')
    const bv = bc.slice(op.j1, op.j2).join('')
    if (tag === 'equal') {
      if (av) left.push({ mark: false, text: av })
      if (bv) right.push({ mark: false, text: bv })
    } else {
      if (av) left.push({ mark: true, text: av })
      if (bv) right.push({ mark: true, text: bv })
    }
  })
  return { left, right }
}
