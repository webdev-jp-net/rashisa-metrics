/**
 * 語を構成する文字の正規表現。このファイルは、agentが書いた変更案の説明を、書いた本人にしか意味が分からない
 * まま読者に出さないための検査と表示用フォールバックを持つ。JavaScriptの`\b`・`\w`・`\d`はASCII専用で
 * 日本語の文字や全角数字を扱えないため、`ex_001は`のような語境界の判定にはUnicodeプロパティエスケープを使う。
 */
const WORD = '[\\p{L}\\p{N}_]'
const DIGIT = '\\p{Nd}'

/** 内部ID。実例集のid（`ex_001`等）と、計画のブロック・候補のid（`p001`・`c001`等）。 */
const ID_PATTERN = `(?:(?:[a-z]+_)?ex_${DIGIT}+|[cp]${DIGIT}{3,})`
/** 読者に意味の無い内部資料・フィールドの名前。 */
const INTERNAL_WORDS = '(?:modelRefList|stylometricProfile|author_writing_sheet|quantifiers)'

/** 読者向けフィールド。評価前・公開前の検査対象で、`refresh-copy`が差し替える対象でもある。 */
export const COPY_FIELD_LIST = ['displayReason', 'tradeoff'] as const

/** 読者に見せてはならない内部の識別子・内部資料名・ファイル名。 */
export const INTERNAL = new RegExp(
  `(?<!${WORD})${ID_PATTERN}(?!${WORD})` +
    `|(?<!${WORD})${INTERNAL_WORDS}(?!${WORD})` +
    `|(?<!${WORD})[\\p{L}\\p{N}_-]+\\.(?:jsonl?|md|py)(?!${WORD})` +
    '|レキシコン|数量語リスト',
  'u'
)

/** 他のエントリを指すだけで、それ単体では何も説明していないコピー。 */
const BACK_REFERENCE_LIST = ['同上。', '同上', '同じ。']

/**
 * 内部向けの注記（括弧書きのid参照、ブロックの説明、他候補との併用注記）を読者向けの文に置き換える。
 *
 * @param value 説明文。
 * @returns 置き換えた説明文。
 */
function withoutInternalNotes(value: string): string {
  let result = value
  result = result.replace(
    /\s*[（(][^（）()]*?(?:ex_|author_writing_sheet|stylometricProfile|quantifiers)[^（）()]*?[）)]/gu,
    ''
  )
  result = result.replace(
    new RegExp(`(?<!${WORD})p${DIGIT}{3}は${DIGIT}+文・約[${DIGIT},，]+字の段落。`, 'gu'),
    '段落を意味の切れ目で分ける。'
  )
  result = result.replace(
    new RegExp(`(?<!${WORD})[cp]${DIGIT}{3,}と合わせて採用すると`, 'gu'),
    '両方を採用すると'
  )
  result = result.replace(
    new RegExp(`(?<!${WORD})[cp]${DIGIT}{3,}と同じ言い換え`, 'gu'),
    '同じ文内の語を統一する'
  )
  result = result.replace(new RegExp(`\\s*(?<!${WORD})${ID_PATTERN}(?!${WORD})`, 'gu'), '')
  result = result.replace(
    /\s*(?:stylometricProfile|author_writing_sheet|quantifiers|レキシコン(?:外)?|数量語リスト(?:に含まれない)?)/gu,
    ''
  )
  return result.replace(/\s{2,}/gu, ' ').trim()
}

/**
 * 表示用の1文。内部IDが残るなら定型文に置き換え、そうでなければ最初の文だけを残す。
 *
 * @param value 説明文。
 * @returns 表示する1文。
 */
function firstSentence(value: string): string {
  const cleaned = withoutInternalNotes(value)
  if (INTERNAL.test(cleaned)) {
    if (new RegExp(`(?<!${WORD})p${DIGIT}{3}(?!${WORD})`, 'u').test(cleaned)) {
      return '段落を意味の切れ目で分ける。'
    }
    return '変更内容を簡潔に整理する。'
  }
  if (BACK_REFERENCE_LIST.includes(cleaned)) return '語調がやや変わる。'
  const partList = cleaned.split(/(?<=[。！？!?])/u)
  return partList.map(part => part.trim()).find(part => part !== '') ?? cleaned
}

/**
 * 画面表示用のフォールバック。agentが書いた変更案の説明を、書いた本人にしか意味が分からないまま
 * 読者に出さないよう、保存済みのJSONには触れずに表示時だけ内部向けの注記を落とし最初の文に絞る。
 *
 * @param edit 公開済みの編集1件。
 * @returns 説明文だけを置き換えた複製。
 */
export function readerCopy<T extends Record<string, unknown>>(edit: T): T {
  return {
    ...edit,
    displayReason: firstSentence(typeof edit.displayReason === 'string' ? edit.displayReason : ''),
    tradeoff: firstSentence(typeof edit.tradeoff === 'string' ? edit.tradeoff : ''),
  }
}

/**
 * 1件の説明文の検査。100文字・80文字の上限はagent向けの執筆ルールであり、ここでの検査対象ではない: このチェックは
 * 各フィールドが文章を持つこと、内部の識別子やファイル名を名指ししていないこと、他のエントリに
 * 委ねる書き方になっていないことだけを確認する。
 *
 * @param edit 候補または公開済みの編集1件。
 * @returns 不備の一覧。無ければ空。
 */
export function copyErrorList(edit: Record<string, unknown>): string[] {
  const errorList: string[] = []
  for (const field of COPY_FIELD_LIST) {
    const value = edit[field]
    if (typeof value !== 'string' || value.trim() === '') {
      errorList.push(`${field}: 文が必要です`)
      continue
    }
    if (INTERNAL.test(value)) {
      errorList.push(`${field}: 内部ID・内部資料名を説明から外してください`)
    }
    if (BACK_REFERENCE_LIST.includes(value.trim())) {
      errorList.push(`${field}: この変更だけで分かる説明にしてください`)
    }
  }
  return errorList
}

/**
 * 候補または公開済み編集の説明文をまとめて検査する。agentが一度に直せるよう、1件目で止めず全件を列挙してからまとめて失敗させる。
 *
 * @param editList 候補または公開済みの編集。
 * @param context エラー文言に出すファイル名。
 * @throws 不備が1件でもあれば全件を列挙して止める。
 */
export function validateCopy(editList: Record<string, unknown>[], context = ''): void {
  const errorList = editList.flatMap(edit =>
    copyErrorList(edit).map(error => `${context} ${edit.id ?? '?'}: ${error}`)
  )
  if (errorList.length > 0) {
    throw new Error(
      `${errorList.join('\n')}\n該当する説明・副作用だけを修正して再検査してください。`
    )
  }
}
