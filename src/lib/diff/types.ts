/** 語diffの1区間。`mark`がtrueなら変更箇所として強調する。 */
export interface DiffSegment {
  mark: boolean
  text: string
}

/** 変更が無い行。 */
export interface DiffContextRow {
  kind: 'context'
  /** 表示用の1始まりの行番号。 */
  oldNumber: number
  newNumber: number
  text: string
}

/** 変更行のペア。番号がnullの側はその行が無い（純粋なinsert/delete）ことを示す。 */
export interface DiffChangedRow {
  kind: 'changed'
  oldNumber: number | null
  newNumber: number | null
  left: DiffSegment[]
  right: DiffSegment[]
}

/** 折りたたんだ未変更行。`hidden`は展開ボタンで少しずつ表示する。 */
export interface DiffFoldRow {
  kind: 'fold'
  /** unified diff形式のhunkヘッダー。例: '@@ -12,7 +12,7 @@' */
  header: string
  hidden: DiffContextRow[]
}

/** 変更案の説明行。対象の変更行の直下に置く。 */
export interface DiffReasonRow {
  kind: 'reason'
  id: string
  title: string
  reason: string
  tradeoff: string
}

/** diff提案の表の1行。 */
export type DiffRow = DiffContextRow | DiffChangedRow | DiffFoldRow | DiffReasonRow

/** `line`（0始まりの旧側行index）を描画する行の下に付けるのを待っている理由。 */
export interface DiffReason {
  line: number
  row: DiffReasonRow
}
