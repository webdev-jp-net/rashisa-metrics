import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

/** カテゴリ → マッチングルール。config/lsm_categories.yamlで定義される。 */
export interface LsmCategorySpec {
  posFilter?: string[]
  extraLemmaList?: string[]
  lemmaList?: string[]
  excludeModalConstruction?: boolean
  notes?: string
  excludeModalConstructionNotes?: string
}

/** `config/lsm_categories.yaml`の形。 */
export interface LsmConfig {
  meta: Record<string, unknown>
  categoryList: Record<string, LsmCategorySpec>
  exclusionList?: string[]
  minTokens: number
}

/** 敬語1分類の語彙。`lemmaList`は辞書形一致、`surfacePatternList`は正規表現。 */
export interface KeigoCategorySpec {
  lemmaList?: string[]
  surfacePatternList?: string[]
  exclusionList?: unknown[]
  notes?: string
}

/** `config/keigo_lexicon.yaml`の形。 */
export interface KeigoConfig {
  meta: Record<string, unknown>
  sonkeigo: KeigoCategorySpec
  kenjougo: KeigoCategorySpec
  teineigo: KeigoCategorySpec
  politenessIndex?: Record<string, unknown>
}

// config/report.jsonと同様、定義ファイルはカレントディレクトリ（リポジトリルート）からの相対パスで読み込む。
const ROOT = process.cwd()

/**
 * YAMLファイルを読んで`T`として返す。実行時の検証は行わない。
 *
 * @param relativePath リポジトリルートからの相対パス。
 * @returns パース結果を`T`として。
 */
function loadYaml<T>(relativePath: string): T {
  return parse(readFileSync(join(ROOT, relativePath), 'utf-8')) as T
}

let lsmConfigCache: LsmConfig | undefined
/**
 * LSMカテゴリ定義。計測のたびに読み直さないよう、プロセス内で1回だけ読む。
 *
 * @returns ファイル内容。
 */
export function loadLsmConfig(): LsmConfig {
  lsmConfigCache ??= loadYaml<LsmConfig>('config/lsm_categories.yaml')
  return lsmConfigCache
}

let keigoConfigCache: KeigoConfig | undefined
/**
 * 敬語語彙。計測のたびに読み直さないよう、プロセス内で1回だけ読む。
 *
 * @returns ファイル内容。
 */
export function loadKeigoConfig(): KeigoConfig {
  keigoConfigCache ??= loadYaml<KeigoConfig>('config/keigo_lexicon.yaml')
  return keigoConfigCache
}
