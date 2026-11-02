import { readFileSync } from 'node:fs'
import { scopeSourcePath, type ReportConfig } from '../config/report-config'
import type { StylometricProfile } from '../data/types'
import { measureDetail } from '../metrics/details'
import { measureTexts } from '../metrics/measure'
import type { MeasurementResult } from '../metrics/types'
import type { Tokenizer } from '../morph'
import { clean, sanitationInfo, type AnonymizationConfig } from '../text/anonymize'
import { chapterSource, type ChapterSourceResult } from '../text/chapter-source'
import { ensure, deepEqual } from './io'
import type { ChapterMeasurement } from './types'

/** 原資料の計測において`measurement.sanitization`に保存される匿名化のタグ。 */
const SANITIZATION_VERSION = 'basic-pii-and-terms-v1'

/** ワークフロー各段階が共有する設定と解析器。解析器を渡すのは、テストで差し替えるため。 */
export interface RevisionContext {
  config: ReportConfig
  tokenizer: Tokenizer
}

/**
 * スコープの原資料ファイルを読んで前処理する。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns スコープ本文と行番号の対応。
 * @throws 設定に無いスコープidなら止める。
 */
export function chapterText(config: ReportConfig, scope: number): ChapterSourceResult {
  return chapterSource(readFileSync(scopeSourcePath(config, scope), 'utf-8'))
}

/**
 * どの匿名化がその数値を生んだかを`measurement.sanitization`に記録する。`measureChapter`と
 * `measureCorpus`が同じ記録を付けるための共通部分。
 *
 * @param profile 匿名化済みテキストの計測結果。
 * @param anonymization 計測に使った媒体の匿名化設定。
 * @returns `measurement.sanitization`を加えた計測結果。
 */
function withSanitization(
  profile: MeasurementResult,
  anonymization: AnonymizationConfig
): MeasurementResult {
  const measurement = {
    ...profile.measurement,
    sanitization: {
      ...sanitationInfo(anonymization.termList),
      version: SANITIZATION_VERSION,
      nonPiiExceptionList: [...anonymization.exceptionList].sort(),
    },
  }
  return { ...profile, measurement }
}

/**
 * スコープ本文を計測する（原文・改稿の両方に使う）。呼び出し元は生の本文を渡し、この関数が計測用に
 * 匿名化（`clean`）して、どの匿名化がその数値を生んだかを`measurement.sanitization`に記録する。
 *
 * @param text 生のスコープ本文。
 * @param ctx 設定と解析器。
 * @returns 計測結果と分子・分母・出現根拠。
 */
export function measureChapter(text: string, ctx: RevisionContext): ChapterMeasurement {
  const anonymization = ctx.config.anonymization.edited
  const details = measureDetail(clean(text, anonymization), ctx.tokenizer)
  return {
    profile: withSanitization(details.profile, anonymization),
    countList: details.countList,
  }
}

/**
 * 複数の文書をまとめて1件の計測結果にする（抽出処理が文体プロファイルを作るのに使う）。1文書だけを
 * 渡したときの結果は`measureChapter`の`profile`と完全に一致する。`baselineCheck`がスコーププロファイルと
 * `measureChapter`の出力の一致を求めるため、この一致を崩してはならない。
 *
 * @param textList 前処理済み・匿名化前の文書本文。
 * @param anonymization 対象媒体の匿名化設定。
 * @param tokenizer 形態素解析器。
 * @returns 計測結果（`measurement.sanitization`付き）。
 * @throws 文書が0件、または空の文書があれば止める。
 */
export function measureCorpus(
  textList: string[],
  anonymization: AnonymizationConfig,
  tokenizer: Tokenizer
): MeasurementResult {
  const cleaned = textList.map(text => clean(text, anonymization))
  return withSanitization(measureTexts(cleaned, { tokenizer }), anonymization)
}

/**
 * 再計測したスコープの全フィールドが保存済みプロファイルと一致することを確かめる。レポートの生成に
 * 使われていない数値の上にplanが組まれることを防ぐ。
 *
 * @param before 再計測した結果（`measureTexts`の形）。
 * @param saved 保存済みプロファイル本体。
 * @throws 1フィールドでも不一致なら止める。
 */
export function baselineCheck(before: unknown, saved: StylometricProfile): void {
  // 計測結果はフラットだが、保存済みプロファイルではこの3つだけ`meta`配下にある
  const metaKeyList = new Set(['schemaVersion', 'measurement', 'corpusSize'])
  const record = before as Record<string, unknown>
  const savedRecord = saved as unknown as Record<string, unknown>
  const savedMeta = saved.meta as unknown as Record<string, unknown>
  for (const key of Object.keys(record)) {
    const expected = metaKeyList.has(key) ? savedMeta[key] : savedRecord[key]
    ensure(deepEqual(record[key], expected), `Saved baseline mismatch: ${key}`)
  }
}
