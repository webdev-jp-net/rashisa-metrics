import { readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { scopeSourcePath, type ReportConfig } from '../config/report-config'
import { sha256File } from '../data/json-io'
import { chapterProfilePath, modelProfilePath } from '../data/profiles'
import { comparisonChapterPath, overviewCriteriaPath } from '../data/report-data'

/** 保存済みの数値の挙動が依存する計測コード。 */
const MEASUREMENT_MODULE_DIR_LIST = ['src/lib/metrics', 'src/lib/text']

/**
 * 計測コードのファイル一覧。ソート済みにするのはハッシュのキー順を安定させるため。
 *
 * @param root リポジトリルート。
 * @returns 絶対パスの列。
 */
function measurementModulePathList(root: string): string[] {
  return MEASUREMENT_MODULE_DIR_LIST.flatMap(dir =>
    readdirSync(resolve(root, dir))
      .filter(name => name.endsWith('.ts'))
      .sort()
      .map(name => join(resolve(root, dir), name))
  )
}

/**
 * ここに挙げた入力のどれかが変わると保存済みplanは無効になる。計測コードを含めるのは、ロジックの変更で数値が変わっても検知するため。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パスの列。
 */
export function sourceHashInputList(config: ReportConfig, scope: number): string[] {
  return [
    scopeSourcePath(config, scope),
    modelProfilePath(config),
    chapterProfilePath(config, scope),
    join(config.pathList.modelProfile, 'exemplar_bank.jsonl'),
    join(config.pathList.modelProfile, 'author_writing_sheet.md'),
    overviewCriteriaPath(config),
    comparisonChapterPath(config, scope),
    ...measurementModulePathList(config.root),
    config.pathList.lsmCategories,
    config.pathList.keigoLexicon,
    resolve(config.root, 'config/report.json'),
  ]
}

/**
 * リポジトリ相対パス→ファイルのバイト列のsha256。`prepare`がこのmapをplanに保存し、`evaluate`/`publish`は再計算して差異があれば処理を止める。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 相対パス → sha256。
 */
export function sourceHashList(config: ReportConfig, scope: number): Record<string, string> {
  const hashList: Record<string, string> = {}
  for (const path of sourceHashInputList(config, scope)) {
    hashList[relative(config.root, path)] = sha256File(path)
  }
  return hashList
}
