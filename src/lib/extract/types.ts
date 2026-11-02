import type { ProfileMeta } from '../data/types'
import type { MeasurementResult } from '../metrics/types'

/** 原資料ディレクトリの1文書。`sourceRef`はファイル名から`.md`を除いた文字列。 */
export interface SourceDocument {
  sourceRef: string
  /** 絶対パス。 */
  path: string
  /** `chapterSource`で前処理した本文。 */
  text: string
}

/**
 * 抽出処理が組み立てた文体プロファイル1件。保存済みの`StylometricProfile`と同じ形だが、解析器なしで
 * 計測したとき（`NullTokenizer`）に`null`になる指標があるため、`MeasurementResult`側の型を使う。
 */
export interface ExtractedProfile extends Omit<
  MeasurementResult,
  'schemaVersion' | 'measurement' | 'corpusSize'
> {
  meta: ProfileMeta
}

/**
 * 実例集（`exemplar_bank.jsonl`）の1行。agentが書くファイルなので、`verify`が形を検査するまで値の型は
 * 信用できない。検査しないフィールド（`register`等）はagentが書いたまま残す。
 */
export interface ExemplarRecord {
  id?: unknown
  text?: unknown
  chars?: unknown
  tagList?: unknown
  structureNote?: unknown
  sourceRef?: unknown
  quality?: unknown
}

/** `prepare --check`の1プロファイル分の照合結果。 */
export interface ProfileCheck {
  register: string
  /** 保存済みプロファイルのリポジトリルートからの相対パス。 */
  path: string
  exists: boolean
  /** 一致しなかった指標フィールドと`corpusSize`・`measurement`。 */
  measured: string[]
  /** 一致しなかった`meta`のその他のフィールド。 */
  meta: string[]
}

/** `prepare`の結果。`--check`では`written`が空、そうでなければ`checkList`が空になる。 */
export interface PrepareResult {
  /** 書き出したプロファイルの絶対パス。 */
  written: string[]
  checkList: ProfileCheck[]
}

/** `verify`の不合格1件。 */
export interface VerifyFailure {
  /** プロファイルディレクトリ名（`model`・`edited`）。 */
  register: string
  /** 対象ファイルのリポジトリルートからの相対パス。 */
  file: string
  /** 対象の実例id・`sourceRef`・行番号（特定できないときは付けない）。 */
  target?: string
  reason: string
}
