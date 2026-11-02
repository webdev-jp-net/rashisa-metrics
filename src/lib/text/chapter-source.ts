/** 前処理した本文と、その各行が元ファイルの何行目かの対応。変更案を原資料へ書き戻すときに使う。 */
export interface ChapterSourceResult {
  text: string
  /** `text`に残った元ファイルの行番号（1始まり）を順番に並べたもの。 */
  lineList: number[]
}

/**
 * 1文書（原資料ディレクトリの1ファイル）の全文を前処理する（measurement.md）。
 * 前処理した本文は`originalTextSha256`で保存済みデータと照合されるため、罫線行の除去・見出しマーカーの除去・
 * 前後の空行トリムの手順を変えると全スコープが不一致になる。改行はプレーンなUTF-8 Markdownを前提に\n・\r\n・\rだけを扱う。
 *
 * @param documentText 1ファイルの全文。
 * @returns 前処理した本文と行番号の対応。
 */
export function chapterSource(documentText: string): ChapterSourceResult {
  const lineList = documentText.split(/\r\n|\r|\n/)
  const kept: [number, string][] = []
  lineList.forEach((line, index) => {
    if (/^\s*---+\s*$/.test(line)) return
    kept.push([index + 1, line.replace(/^#{1,6} /, '')])
  })
  while (kept.length > 0 && kept[0][1].trim() === '') kept.shift()
  while (kept.length > 0 && kept[kept.length - 1][1].trim() === '') kept.pop()

  return {
    text: kept
      .map(([, line]) => line)
      .join('\n')
      .trim(),
    lineList: kept.map(([lineNumber]) => lineNumber),
  }
}
