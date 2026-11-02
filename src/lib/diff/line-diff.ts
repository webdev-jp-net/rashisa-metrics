import { charOpcodeList, lineOpcodeList, type Opcode } from './sequence-matcher'
import type {
  DiffChangedRow,
  DiffContextRow,
  DiffFoldRow,
  DiffReason,
  DiffRow,
  DiffSegment,
} from './types'

/** 変更箇所の前後で、残りを折りたたむ前に両側に残す未変更行の数。 */
export const CONTEXT = 3

/** 行と、それが描画する旧側の行番号の組。理由をドキュメント順に紐付けるために使う。 */
interface PlacedRow {
  oldNumber: number | null
  row: DiffRow
}

/**
 * 変更が無い行を作る。行番号は0始まりのindexから表示用の1始まりに直す。
 *
 * @param oldIndex 旧側の行index。
 * @param newIndex 新側の行index。
 * @param text 行の本文。
 * @returns 行。
 */
function contextRow(oldIndex: number, newIndex: number, text: string): DiffContextRow {
  return { kind: 'context', oldNumber: oldIndex + 1, newNumber: newIndex + 1, text }
}

/**
 * 変更行1組。
 *
 * @param oldNumber 旧側の行番号（1始まり）。無ければnull。
 * @param left 旧側の語diff。
 * @param newNumber 新側の行番号（1始まり）。無ければnull。
 * @param right 新側の語diff。
 * @returns 行。
 */
function changedRow(
  oldNumber: number | null,
  left: DiffSegment[],
  newNumber: number | null,
  right: DiffSegment[]
): DiffChangedRow {
  return { kind: 'changed', oldNumber, newNumber, left, right }
}

/**
 * 強調なしの1区間。空文字なら区間を作らない。
 *
 * @param text 本文。
 * @returns 区間。
 */
function plain(text: string): DiffSegment[] {
  return text ? [{ mark: false, text }] : []
}

/**
 * 折りたたみ行。`header`は隠れた行の範囲を`@@ -12,7 +12,7 @@`形式（unified diffのhunkヘッダー）で示す。
 *
 * @param hidden 隠す旧側の行index。
 * @param oldLineList 旧側の全行。
 * @param oldStart この編集手順（opcode）の旧側開始index。
 * @param newStart この編集手順（opcode）の新側開始index。
 * @returns 折りたたみ行。
 */
function foldRow(
  hidden: number[],
  oldLineList: readonly string[],
  oldStart: number,
  newStart: number
): DiffFoldRow {
  const count = hidden.length
  const oldA = hidden[0] + 1
  const newA = hidden[0] - oldStart + newStart + 1
  return {
    kind: 'fold',
    header: `@@ -${oldA},${count} +${newA},${count} @@`,
    hidden: hidden.map(n => contextRow(n, n - oldStart + newStart, oldLineList[n])),
  }
}

/**
 * 旧・新の行範囲が1:1に対応しない'replace'の編集手順（opcode。段落の分割・統合）を描画する。
 * 範囲を行単位でそのまま対応付けると無関係な行同士を比較してしまう。範囲全体を文字単位で
 * 差分にかければ、別の行へ移っただけの内容は無印のまま残しつつ、実際の語レベルの編集だけを
 * マークできる。
 *
 * @param oldLineList 旧側の全行。
 * @param newLineList 新側の全行。
 * @param oldSpan 置き換えられる旧側の行index。
 * @param newSpan 置き換える新側の行index。
 * @returns 配置済みの行。
 */
function nestedReplaceRowList(
  oldLineList: readonly string[],
  newLineList: readonly string[],
  oldSpan: number[],
  newSpan: number[]
): PlacedRow[] {
  const oldText = oldSpan.map(n => oldLineList[n]).join('\n')
  const newText = newSpan.map(n => newLineList[n]).join('\n')
  const oldCharList = Array.from(oldText)
  const newCharList = Array.from(newText)
  const opcodeList = charOpcodeList(oldText, newText)
  const rowList: PlacedRow[] = []
  let leftBuffer: DiffSegment[] = []
  let rightBuffer: DiffSegment[] = []
  let leftNumber = oldSpan[0] + 1
  let rightNumber = newSpan[0] + 1

  const flushLeft = () => {
    rowList.push({ oldNumber: leftNumber, row: changedRow(leftNumber, leftBuffer, null, []) })
    leftBuffer = []
    leftNumber += 1
  }
  const flushRight = () => {
    rowList.push({ oldNumber: null, row: changedRow(null, [], rightNumber, rightBuffer) })
    rightBuffer = []
    rightNumber += 1
  }

  for (const op of opcodeList) {
    const av = oldCharList.slice(op.i1, op.i2).join('')
    const bv = newCharList.slice(op.j1, op.j2).join('')
    const mark = op.tag !== 'equal'
    if (op.tag === 'equal') {
      const partList = av.split('\n')
      partList.forEach((part, index) => {
        if (part) {
          leftBuffer.push({ mark, text: part })
          rightBuffer.push({ mark, text: part })
        }
        if (index < partList.length - 1) {
          rowList.push({
            oldNumber: leftNumber,
            row: changedRow(leftNumber, leftBuffer, rightNumber, rightBuffer),
          })
          leftBuffer = []
          rightBuffer = []
          leftNumber += 1
          rightNumber += 1
        }
      })
    } else {
      const aPartList = av.split('\n')
      aPartList.forEach((part, index) => {
        if (part) leftBuffer.push({ mark, text: part })
        if (index < aPartList.length - 1) flushLeft()
      })
      const bPartList = bv.split('\n')
      bPartList.forEach((part, index) => {
        if (part) rightBuffer.push({ mark, text: part })
        if (index < bPartList.length - 1) flushRight()
      })
    }
  }
  rowList.push({
    oldNumber: leftNumber,
    row: changedRow(leftNumber, leftBuffer, rightNumber, rightBuffer),
  })
  return rowList
}

/**
 * 行差分の編集手順（opcode。`lineOpcodeList`の結果）を調整する。変更の連続区間（run）に挟まれた1行だけの'equal'
 * 区間（多くは両側にある空行）は偶然の一致にすぎない。
 * そのまま残すと1つの段落の組み替えが2つに分断され、移動した内容が無関係な編集の説明の
 * 隣に浮いたinsertとして描画されてしまう。そうしたrunは周囲の'replace'範囲に吸収し、
 * 組み替え全体を1つの単位として差分にかける。
 *
 * @param opcodeList 行差分の編集手順。
 * @returns 調整後の編集手順。
 */
function mergeIncidentalEqualRunList(opcodeList: Opcode[]): Opcode[] {
  const treatAsChanged = opcodeList.map(
    (op, index) =>
      op.tag !== 'equal' ||
      (index > 0 &&
        index < opcodeList.length - 1 &&
        op.i2 - op.i1 <= 1 &&
        opcodeList[index - 1].tag !== 'equal' &&
        opcodeList[index + 1].tag !== 'equal')
  )
  const out: Opcode[] = []
  opcodeList.forEach((op, index) => {
    const changed = treatAsChanged[index]
    const last = out[out.length - 1]
    if (changed && last && last.tag === 'replace') {
      last.i2 = op.i2
      last.j2 = op.j2
    } else if (changed) {
      out.push({ tag: 'replace', i1: op.i1, i2: op.i2, j1: op.j1, j2: op.j2 })
    } else {
      out.push({ ...op })
    }
  })
  return out
}

/**
 * 原文・改稿の行配列から、diff提案の表に出す行の並びを作る。未変更行は前後3行（`CONTEXT`）だけ残して折りたたむ。
 *
 * @param oldLineList 原文の行。
 * @param newLineList 改稿の行。
 * @param reasonList 変更案の説明行。対象の旧側行の直下に置く。
 * @returns 表に出す行の並び。
 */
export function renderDiffRowList(
  oldLineList: readonly string[],
  newLineList: readonly string[],
  reasonList: readonly DiffReason[] = []
): DiffRow[] {
  const opcodeList = mergeIncidentalEqualRunList(lineOpcodeList(oldLineList, newLineList))
  const placed: PlacedRow[] = []
  opcodeList.forEach((op, index) => {
    if (op.tag === 'equal') {
      const span: number[] = []
      for (let n = op.i1; n < op.i2; n += 1) span.push(n)
      const headLength = index === 0 ? 0 : CONTEXT
      const tailLength = index === opcodeList.length - 1 ? 0 : CONTEXT
      if (span.length <= headLength + tailLength) {
        for (const n of span) {
          placed.push({ oldNumber: n + 1, row: contextRow(n, n - op.i1 + op.j1, oldLineList[n]) })
        }
        return
      }
      const head = headLength ? span.slice(0, headLength) : []
      const tail = tailLength ? span.slice(span.length - tailLength) : []
      const hidden = span.slice(headLength, span.length - tailLength)
      for (const n of head) {
        placed.push({ oldNumber: n + 1, row: contextRow(n, n - op.i1 + op.j1, oldLineList[n]) })
      }
      if (hidden.length > 0) {
        placed.push({ oldNumber: null, row: foldRow(hidden, oldLineList, op.i1, op.j1) })
      }
      for (const n of tail) {
        placed.push({ oldNumber: n + 1, row: contextRow(n, n - op.i1 + op.j1, oldLineList[n]) })
      }
    } else if (op.tag === 'replace') {
      const oldSpan: number[] = []
      for (let n = op.i1; n < op.i2; n += 1) oldSpan.push(n)
      const newSpan: number[] = []
      for (let n = op.j1; n < op.j2; n += 1) newSpan.push(n)
      placed.push(...nestedReplaceRowList(oldLineList, newLineList, oldSpan, newSpan))
    } else if (op.tag === 'delete') {
      for (let n = op.i1; n < op.i2; n += 1) {
        placed.push({ oldNumber: n + 1, row: changedRow(n + 1, plain(oldLineList[n]), null, []) })
      }
    } else {
      for (let n = op.j1; n < op.j2; n += 1) {
        placed.push({ oldNumber: null, row: changedRow(null, [], n + 1, plain(newLineList[n])) })
      }
    }
  })

  const out: DiffRow[] = []
  const attached = new Set<number>()
  for (const { oldNumber, row } of placed) {
    out.push(row)
    if (oldNumber === null) continue
    reasonList.forEach((reason, position) => {
      if (!attached.has(position) && reason.line === oldNumber - 1) {
        out.push(reason.row)
        attached.add(position)
      }
    })
  }
  // 対象行がfoldに隠れた理由は捨てず、末尾にまとめて出す
  reasonList.forEach((reason, position) => {
    if (!attached.has(position)) out.push(reason.row)
  })
  return out
}
