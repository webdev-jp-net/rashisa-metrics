import { relative } from 'node:path'
import { measureCorpus, type RevisionContext } from '../revision/measure'
import type { AnonymizationConfig } from '../text/anonymize'
import { sourceFileListOf } from './sources'
import type { ExtractedProfile, SourceDocument } from './types'

/** 文書の前処理規則の識別子（`chapterSource`の手順）。手順を変えたらこの値も変える。 */
const PREPROCESSING_RULE = 'markdown-document-v1'

/** `meta.textState`。計測前に匿名化した状態であることの明示。 */
const TEXT_STATE = 'sanitized'

/** 1件のプロファイルを組み立てるのに要る、計測対象と出所の情報。 */
export interface BuildProfileInput {
  /** プロファイルディレクトリのbasename（`model`・`edited`・`scope3`）。 */
  register: string
  /** 原資料ディレクトリの絶対パス。 */
  sourceDir: string
  /** 計測する文書（この順に計測する）。 */
  documentList: SourceDocument[]
  /** 対象媒体の匿名化設定。 */
  anonymization: AnonymizationConfig
}

/**
 * 文書を計測し、保存形式の文体プロファイル1件にする。計測結果のうち`schemaVersion`・`measurement`・
 * `corpusSize`だけが`meta`配下に移り、残りの指標はトップレベルに並ぶ（measurement.md）。
 *
 * @param ctx 設定と解析器。
 * @param input 計測対象と出所の情報。
 * @returns 文体プロファイル1件（`stylometricProfile`の中身）。
 * @throws 文書が0件、または空の文書があれば止める。
 */
export function buildProfile(ctx: RevisionContext, input: BuildProfileInput): ExtractedProfile {
  const { schemaVersion, measurement, corpusSize, ...metrics } = measureCorpus(
    input.documentList.map(document => document.text),
    input.anonymization,
    ctx.tokenizer
  )
  return {
    meta: {
      register: input.register,
      corpusSize,
      textState: TEXT_STATE,
      measurement,
      schemaVersion,
      sourceDir: relative(ctx.config.root, input.sourceDir),
      sourceFileList: sourceFileListOf(ctx.config.root, input.documentList),
      preprocessingRule: PREPROCESSING_RULE,
    },
    ...metrics,
  }
}
