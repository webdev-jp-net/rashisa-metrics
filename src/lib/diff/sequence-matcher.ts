export type OpcodeTag = 'equal' | 'replace' | 'delete' | 'insert'

/** 編集手順1つ。旧側`[i1, i2)`を新側`[j1, j2)`に`tag`（equal／replace／delete／insert）する。Python difflibの`get_opcodes()`と同じ形。 */
export interface Opcode {
  tag: OpcodeTag
  i1: number
  i2: number
  j1: number
  j2: number
}

/** 一致ブロック。`a`・`b`は各列の開始index、`size`は長さ。 */
export interface Match {
  a: number
  b: number
  size: number
}

/**
 * 2つの列（行または文字）の一致ブロックと編集手順（opcode）を求める。アルゴリズムはPython標準ライブラリ
 * difflibのSequenceMatcher（`isjunk=None, autojunk=False`相当）と同一。別ライブラリjsdiffのMyers差分は
 * （同等に妥当だが）異なる境界を選ぶことがあり、それによって折りたたみ範囲や語レベルのマークの位置が
 * ずれてしまう。そのため探索をそのまま忠実に再現している: 同じ索引（`b2j`: 新側の要素→出現index）、
 * 同じ最長一致の同点判定、同じ再帰順序。
 */
export class SequenceMatcher {
  private readonly a: readonly string[]
  private readonly b: readonly string[]
  private readonly b2j = new Map<string, number[]>()

  /**
   * @param a 旧側の列。
   * @param b 新側の列。
   */
  constructor(a: readonly string[], b: readonly string[]) {
    this.a = a
    this.b = b
    b.forEach((element, index) => {
      const indexList = this.b2j.get(element)
      if (indexList) indexList.push(index)
      else this.b2j.set(element, [index])
    })
  }

  /**
   * 範囲内の最長一致。同じ長さならaの先頭側を採る（difflibと同じ同点判定）。
   *
   * @param alo aの範囲の開始。
   * @param ahi aの範囲の終了（含まない）。
   * @param blo bの範囲の開始。
   * @param bhi bの範囲の終了（含まない）。
   * @returns 最長一致。無ければsize 0。
   */
  findLongestMatch(alo: number, ahi: number, blo: number, bhi: number): Match {
    const { a, b, b2j } = this
    let besti = alo
    let bestj = blo
    let bestsize = 0
    let j2len = new Map<number, number>()
    for (let i = alo; i < ahi; i += 1) {
      const newj2len = new Map<number, number>()
      const indexList = b2j.get(a[i]) ?? []
      for (const j of indexList) {
        if (j < blo) continue
        if (j >= bhi) break
        const k = (j2len.get(j - 1) ?? 0) + 1
        newj2len.set(j, k)
        if (k > bestsize) {
          besti = i - k + 1
          bestj = j - k + 1
          bestsize = k
        }
      }
      j2len = newj2len
    }
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti -= 1
      bestj -= 1
      bestsize += 1
    }
    while (
      besti + bestsize < ahi &&
      bestj + bestsize < bhi &&
      a[besti + bestsize] === b[bestj + bestsize]
    ) {
      bestsize += 1
    }
    return { a: besti, b: bestj, size: bestsize }
  }

  /**
   * 最長一致で再帰的に分割した一致ブロックを昇順に。隣接するブロックは1つにまとめ、末尾に番兵（size 0）を置く。
   *
   * @returns 一致ブロック。
   */
  getMatchingBlockList(): Match[] {
    const la = this.a.length
    const lb = this.b.length
    const queue: [number, number, number, number][] = [[0, la, 0, lb]]
    const matching: Match[] = []
    while (queue.length > 0) {
      const [alo, ahi, blo, bhi] = queue.pop()!
      const match = this.findLongestMatch(alo, ahi, blo, bhi)
      const { a: i, b: j, size: k } = match
      if (k > 0) {
        matching.push(match)
        if (alo < i && blo < j) queue.push([alo, i, blo, j])
        if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi])
      }
    }
    matching.sort((x, y) => x.a - y.a || x.b - y.b || x.size - y.size)

    let i1 = 0
    let j1 = 0
    let k1 = 0
    const merged: Match[] = []
    for (const { a: i2, b: j2, size: k2 } of matching) {
      if (i1 + k1 === i2 && j1 + k1 === j2) {
        k1 += k2
      } else {
        if (k1 > 0) merged.push({ a: i1, b: j1, size: k1 })
        i1 = i2
        j1 = j2
        k1 = k2
      }
    }
    if (k1 > 0) merged.push({ a: i1, b: j1, size: k1 })
    merged.push({ a: la, b: lb, size: 0 })
    return merged
  }

  /**
   * 一致ブロックの隙間をreplace/delete/insertとして埋めた編集手順。
   *
   * @returns 編集手順。
   */
  getOpcodeList(): Opcode[] {
    let i = 0
    let j = 0
    const answer: Opcode[] = []
    for (const { a: ai, b: bj, size } of this.getMatchingBlockList()) {
      let tag: OpcodeTag | '' = ''
      if (i < ai && j < bj) tag = 'replace'
      else if (i < ai) tag = 'delete'
      else if (j < bj) tag = 'insert'
      if (tag) answer.push({ tag, i1: i, i2: ai, j1: j, j2: bj })
      i = ai + size
      j = bj + size
      if (size > 0) answer.push({ tag: 'equal', i1: ai, i2: i, j1: bj, j2: j })
    }
    return answer
  }
}

/**
 * 行単位の差分。行diffの入口。
 *
 * @param a 原文の行。
 * @param b 改稿の行。
 * @returns 編集手順。
 */
export function lineOpcodeList(a: readonly string[], b: readonly string[]): Opcode[] {
  return new SequenceMatcher(a, b).getOpcodeList()
}

/**
 * 文字単位の差分。語diffの入口。コードポイント単位に分けるのは、サロゲートペアを途中で切らないため。
 *
 * @param a 原文。
 * @param b 改稿。
 * @returns 編集手順（indexはコードポイント単位）。
 */
export function charOpcodeList(a: string, b: string): Opcode[] {
  return new SequenceMatcher(Array.from(a), Array.from(b)).getOpcodeList()
}
