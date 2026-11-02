import { existsSync, readFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import type { ReportConfig } from '../config/report-config'
import { sha256File } from '../data/json-io'
import { editedProfilePath, loadStylometricProfile, modelProfilePath } from '../data/profiles'
import { codePointLength } from '../metrics/text-stats'
import type { AnonymizationConfig } from '../text/anonymize'
import { chapterSource } from '../text/chapter-source'
import type { ExemplarRecord, VerifyFailure } from './types'

/** 実例の`quality`に使える値。 */
const QUALITY_VALUE_LIST = new Set(['gold', 'silver'])

/** agentが書く文書。どちらも出典を1つ以上引いていることを検査する。 */
const AGENT_DOCUMENT_LIST = ['author_writing_sheet.md', 'expert_synthesis.md']

/** 実例集のファイル名。 */
const EXEMPLAR_BANK = 'exemplar_bank.jsonl'

/** 識別子（`sourceRef`・実例id）の一部として現れうる文字。`scope-0`が`scope-01`に誤一致しないための境界判定に使う。 */
const IDENTIFIER_CHAR = /[0-9A-Za-z_\-./:]/

/** 検査する媒体1つ分の入口。 */
interface VerifyMedia {
  /** プロファイルディレクトリのbasename。 */
  register: string
  /** プロファイルディレクトリの絶対パス。 */
  dir: string
  /** `stylometric_profile.json`の絶対パス。 */
  profilePath: string
  anonymization: AnonymizationConfig
}

/**
 * 識別子がその文書に引用されているかを見る。前後が識別子の文字でない位置での一致だけを数える。
 *
 * @param text 文書全文。
 * @param identifier `sourceRef`または実例id。
 * @returns 引用されていればtrue。
 */
function mentions(text: string, identifier: string): boolean {
  if (identifier === '') return false
  let index = text.indexOf(identifier)
  while (index !== -1) {
    const before = text[index - 1]
    const after = text[index + identifier.length]
    const openLeft = before === undefined || !IDENTIFIER_CHAR.test(before)
    const openRight = after === undefined || !IDENTIFIER_CHAR.test(after)
    if (openLeft && openRight) return true
    index = text.indexOf(identifier, index + 1)
  }
  return false
}

/**
 * 実例1件を検査する。`sourceRef`の指す文書が読めなかった場合は、本文の照合だけを飛ばす（読めない理由は
 * プロファイル側の不合格として別に報告済み）。
 *
 * @param record 実例集の1行。
 * @param context 検査に使う材料。
 * @param context.sourceRefList プロファイルの`meta.sourceFileList[].sourceRef`。
 * @param context.textList `sourceRef`→前処理後の本文。
 * @param context.termList 対象媒体の匿名化用語。
 * @param context.seenIds ここまでに出たid（重複判定に使い、このidを足す）。
 * @param context.add 不合格1件を記録する関数。引数は理由と対象。
 * @param fallbackTarget idが読めないときに報告へ載せる対象名（行番号）。
 */
function verifyExemplar(
  record: ExemplarRecord,
  context: {
    sourceRefList: Set<string>
    textList: Map<string, string>
    termList: string[]
    seenIdList: Set<string>
    add: (reason: string, target: string) => void
  },
  fallbackTarget: string
): void {
  const { id, text, chars, tagList, structureNote, sourceRef: ref, quality } = record
  const target = typeof id === 'string' && id !== '' ? id : fallbackTarget
  const { add } = context

  if (typeof id !== 'string' || id === '') add('idがありません', target)
  else if (context.seenIdList.has(id)) add('idが重複しています', target)
  else context.seenIdList.add(id)

  if (typeof quality !== 'string' || !QUALITY_VALUE_LIST.has(quality)) {
    add(`qualityはgoldかsilverにしてください: ${JSON.stringify(quality)}`, target)
  }
  if (!Array.isArray(tagList)) add('tagListが配列ではありません', target)
  if (typeof structureNote !== 'string' || structureNote.trim() === '') {
    add('structureNoteが空です', target)
  }

  if (typeof text !== 'string') {
    add('textが文字列ではありません', target)
    return
  }
  // 空文字はどの本文にも`includes`で含まれてしまうため、引用の照合に進める前に落とす
  if (text === '') {
    add('textが空です', target)
    return
  }
  if (typeof chars !== 'number' || chars !== codePointLength(text)) {
    add(`charsがtextの文字数（${codePointLength(text)}）と一致しません`, target)
  }
  for (const term of context.termList) {
    if (text.includes(term)) add(`textに匿名化対象の用語が残っています: ${term}`, target)
  }

  if (typeof ref !== 'string' || !context.sourceRefList.has(ref)) {
    add(`sourceRefがプロファイルの原資料にありません: ${JSON.stringify(ref)}`, target)
    return
  }
  const source = context.textList.get(ref)
  if (source !== undefined && !source.includes(text)) {
    add(`textが${ref}の本文の一部と一致しません`, target)
  }
}

/**
 * 媒体1つ分を検査する。プロファイルが読めなければ以降の検査は材料が揃わないため、その1件だけを返す。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param media 検査する媒体。
 * @returns 不合格の一覧（合格なら空）。
 */
function verifyMedia(config: ReportConfig, media: VerifyMedia): VerifyFailure[] {
  const failureList: VerifyFailure[] = []
  const report = (file: string, reason: string, target?: string): void => {
    const failure: VerifyFailure = {
      register: media.register,
      file: relative(config.root, file),
      reason,
    }
    if (target !== undefined) failure.target = target
    failureList.push(failure)
  }

  if (!existsSync(media.profilePath)) {
    report(media.profilePath, '文体プロファイルがありません。extract prepareで作ってください')
    return failureList
  }
  const { meta } = loadStylometricProfile(media.profilePath).stylometricProfile
  const sourceFileList = meta.sourceFileList ?? []
  if (sourceFileList.length === 0) {
    report(media.profilePath, 'meta.sourceFileListが空です。extract prepareで作り直してください')
  }
  const textList = new Map<string, string>()
  for (const file of sourceFileList) {
    const path = resolve(config.root, file.path)
    if (!existsSync(path)) {
      report(media.profilePath, `原資料がありません: ${file.path}`, file.sourceRef)
      continue
    }
    if (sha256File(path) !== file.sha256) {
      report(
        media.profilePath,
        `原資料が計測時から変わっています: ${file.path}。extract prepareで計測し直してください`,
        file.sourceRef
      )
    }
    textList.set(file.sourceRef, chapterSource(readFileSync(path, 'utf-8')).text)
  }
  const sourceRefList = new Set(sourceFileList.map(file => file.sourceRef))

  const bankPath = join(media.dir, EXEMPLAR_BANK)
  const idList = new Set<string>()
  if (!existsSync(bankPath)) {
    report(bankPath, '実例集がありません')
  } else {
    const lineList = readFileSync(bankPath, 'utf-8')
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(entry => entry.line.trim() !== '')
    if (lineList.length === 0) report(bankPath, '実例集が空です')
    for (const entry of lineList) {
      const target = `${entry.number}行目`
      let record: ExemplarRecord
      try {
        record = JSON.parse(entry.line) as ExemplarRecord
      } catch {
        report(bankPath, 'JSONとして読めません', target)
        continue
      }
      verifyExemplar(
        record,
        {
          sourceRefList,
          textList,
          termList: media.anonymization.termList,
          seenIdList: idList,
          add: (reason, exemplar) => report(bankPath, reason, exemplar),
        },
        target
      )
    }
  }

  const citable = [...sourceRefList, ...idList]
  for (const name of AGENT_DOCUMENT_LIST) {
    const path = join(media.dir, name)
    if (!existsSync(path)) {
      report(path, 'ファイルがありません')
      continue
    }
    const text = readFileSync(path, 'utf-8')
    if (text.trim() === '') {
      report(path, '中身が空です')
      continue
    }
    if (!citable.some(identifier => mentions(text, identifier))) {
      report(path, '出典（sourceRefか実例id）が1件も書かれていません')
    }
  }
  return failureList
}

/**
 * 抽出処理の検査工程。両媒体について、文体プロファイルが現在の原資料と揃っていること、実例集・書き方シート・
 * 統合文書が形式どおりであることを見る。中身の良し悪しは検査しない。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 不合格の一覧（合格なら空）。
 */
export function verify(config: ReportConfig): VerifyFailure[] {
  const media: VerifyMedia[] = [
    {
      register: basename(config.pathList.modelProfile),
      dir: config.pathList.modelProfile,
      profilePath: modelProfilePath(config),
      anonymization: config.anonymization.model,
    },
    {
      register: basename(config.pathList.editedProfile),
      dir: config.pathList.editedProfile,
      profilePath: editedProfilePath(config),
      anonymization: config.anonymization.edited,
    },
  ]
  return media.flatMap(entry => verifyMedia(config, entry))
}
