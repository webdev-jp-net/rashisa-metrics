import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { ensure } from '../revision/io'

/** 全シリーズの設定を並べたファイル（リポジトリルートからの相対パス）。 */
const SERIES_INDEX_PATH = 'data/index.json'

/** スコープと原稿ファイルの対応を書いたファイル。編集対象媒体の原資料ディレクトリ直下に置く。 */
const SCOPE_INDEX_FILE = 'index.json'

/** お手本媒体の表示名のプレースホルダー。microCMSの`series.modelLabel`で解決する。 */
export const MODEL_LABEL_PLACEHOLDER = '{modelLabel}'

/**
 * 個別スコープ。`id`はスコープのキーで、0から始まる連番には限らない。`file`は`pathList.editedSource`からの
 * 相対ファイル名で、重複しない。
 */
export interface ReportScope {
  id: number
  file: string
}

/** 入力・出力の置き場。`ReportConfig`では絶対パス。 */
export interface ReportConfigPathListRaw {
  /** 編集対象媒体の原資料ディレクトリ。1スコープ＝1ファイル。 */
  editedSource: string
  /** お手本媒体の原資料ディレクトリ。1記事＝1ファイル。 */
  modelSource: string
  modelProfile: string
  editedProfile: string
  /** `{scope}`プレースホルダを含み、スコープidで置換される。 */
  editedScopeProfile: string
  report: string
  propose: string
  lsmCategories: string
  keigoLexicon: string
}

/** 入力整形の用語・例外・著者用語。`src/lib/text/anonymize.ts`の`AnonymizationConfig`と同じ形。 */
export interface ReportAnonymizationConfig {
  termList: string[]
  exceptionList: string[]
  authorTerm: string
}

/** 媒体ごとの入力整形の設定。両媒体に同じ前処理を適用し、用語・例外だけを媒体ごとに変える。 */
export interface ReportAnonymizationByMedia {
  model: ReportAnonymizationConfig
  edited: ReportAnonymizationConfig
}

/** config/report.json。シリーズ固有の値（原稿パス・実名）をリポジトリに置かないため、この側はシリーズに依存しない値だけを持つ。 */
export interface ReportConfigFile {
  pathList: Pick<ReportConfigPathListRaw, 'lsmCategories' | 'keigoLexicon'>
}

/**
 * `data/index.json`の1件。1組の媒体ペア（シリーズ）に固有の設定。`seriesKey`はmicroCMSの`series.seriesKey`と
 * 一致させ、成果物のディレクトリ名（`data/<seriesKey>/`）にも使う。原資料の置き場はリポジトリルートからの相対パス。
 */
export interface SeriesIndexEntry {
  seriesKey: string
  modelSource: string
  editedSource: string
  anonymization: ReportAnonymizationByMedia
}

/** config/report.jsonと、選んだシリーズの設定を統合したもの。`pathList.*`の各値は絶対パスに解決済み。 */
export interface ReportConfig {
  root: string
  seriesKey: string
  scopeList: ReportScope[]
  pathList: ReportConfigPathListRaw
  anonymization: ReportAnonymizationByMedia
}

/**
 * `config/report.json`を読む。実行時の検証はしない。
 *
 * @param root リポジトリルート。
 * @returns ファイル内容。
 */
function readRepoConfig(root: string): ReportConfigFile {
  return JSON.parse(readFileSync(resolve(root, 'config/report.json'), 'utf-8')) as ReportConfigFile
}

/**
 * `data/index.json`を読む。
 *
 * @param seriesIndex `data/index.json`の絶対パス。
 * @returns 全シリーズの設定。
 * @throws 配列でなければ止める。
 */
function readSeriesIndex(seriesIndex: string): SeriesIndexEntry[] {
  const entryList = JSON.parse(readFileSync(seriesIndex, 'utf-8')) as SeriesIndexEntry[]
  ensure(Array.isArray(entryList), `${seriesIndex}: must be an array of series settings`)
  return entryList
}

/**
 * スコープと原稿ファイルの対応（`<editedSource>/index.json`）を読み、`id`と`file`の形と重複を確かめる。
 *
 * @param scopeIndex `<editedSource>/index.json`の絶対パス。
 * @returns スコープの一覧（ファイル上の並びのまま）。
 * @throws ファイルが無い、配列でない、`id`が整数でない、`file`が文字列でない、または`id`・`file`が重複していれば止める。
 */
function readScopeIndex(scopeIndex: string): ReportScope[] {
  if (!existsSync(scopeIndex)) {
    throw new Error(`スコープと原稿ファイルの対応がありません: ${scopeIndex}`)
  }
  const scopeList = JSON.parse(readFileSync(scopeIndex, 'utf-8')) as ReportScope[]
  ensure(Array.isArray(scopeList), `${scopeIndex}: must be an array of { id, file }`)
  const idSet = new Set<number>()
  const fileSet = new Set<string>()
  for (const scope of scopeList) {
    ensure(Number.isInteger(scope.id), `${scopeIndex}: id must be an integer, got ${scope.id}`)
    ensure(typeof scope.file === 'string', `${scopeIndex}: file must be a string (id ${scope.id})`)
    ensure(!idSet.has(scope.id), `${scopeIndex}: duplicate id ${scope.id}`)
    ensure(!fileSet.has(scope.file), `${scopeIndex}: duplicate file ${scope.file}`)
    idSet.add(scope.id)
    fileSet.add(scope.file)
  }
  return scopeList
}

/**
 * config/report.jsonとシリーズの設定を1つの`ReportConfig`に合成する。成果物の置き場は`data/<seriesKey>/`から導き、
 * 相対パスはリポジトリルート基準の絶対パスにする。コードは合成後の値だけを読む（tech_structure.md）。
 *
 * @param root リポジトリルート。
 * @param config `config/report.json`の内容。
 * @param entry 選んだシリーズの設定。
 * @returns 合成した設定。
 * @throws スコープと原稿ファイルの対応が読めなければ止める（`readScopeIndex`）。
 */
function buildReportConfig(
  root: string,
  config: ReportConfigFile,
  entry: SeriesIndexEntry
): ReportConfig {
  const editedSource = resolve(root, entry.editedSource)
  const scopeIndex = join(editedSource, SCOPE_INDEX_FILE)
  const seriesDir = resolve(root, 'data', entry.seriesKey)
  const editedProfile = join(seriesDir, 'profiles/edited')

  const pathList: ReportConfigPathListRaw = {
    editedSource,
    modelSource: resolve(root, entry.modelSource),
    modelProfile: join(seriesDir, 'profiles/model'),
    editedProfile,
    editedScopeProfile: join(editedProfile, 'scope{scope}'),
    report: join(seriesDir, 'report'),
    propose: join(seriesDir, 'propose'),
    lsmCategories: resolve(root, config.pathList.lsmCategories),
    keigoLexicon: resolve(root, config.pathList.keigoLexicon),
  }

  return {
    root,
    seriesKey: entry.seriesKey,
    scopeList: readScopeIndex(scopeIndex),
    pathList,
    anonymization: entry.anonymization,
  }
}

/**
 * `data/index.json`から`seriesKey`が一致する1件を取り出す。
 *
 * @param seriesIndex `data/index.json`の絶対パス。
 * @param seriesKey 探すシリーズ。
 * @returns そのシリーズの設定（ファイル上の内容のまま）。
 * @throws ファイルが無い、配列でない、または`seriesKey`のシリーズが無いか重複していれば止める。
 */
function readSeriesEntry(seriesIndex: string, seriesKey: string): SeriesIndexEntry {
  if (!existsSync(seriesIndex)) {
    throw new Error(`シリーズの設定ファイルがありません: ${seriesIndex}`)
  }
  const entryList = readSeriesIndex(seriesIndex)
  const matchedList = entryList.filter(entry => entry.seriesKey === seriesKey)
  ensure(
    matchedList.length > 0,
    `${seriesIndex}にseriesKey '${seriesKey}'のシリーズがありません` +
      `（登録済み: ${entryList.map(entry => entry.seriesKey).join(', ') || 'なし'}）`
  )
  ensure(matchedList.length === 1, `${seriesIndex}: seriesKey '${seriesKey}' is duplicated`)
  return matchedList[0]
}

/**
 * 作業対象のシリーズの設定を読む。`data/index.json`から`seriesKey`が一致する1件を探す。
 *
 * @param seriesKey 作業対象のシリーズ（CLIの引数`--series`）。
 * @param root リポジトリルート。既定はカレントディレクトリ。
 * @returns 合成した設定。
 * @throws `data/index.json`が無い、`seriesKey`のシリーズが無いか重複している、またはスコープと原稿ファイルの
 *   対応が読めなければ止める。
 */
export function loadReportConfig(seriesKey: string, root: string = process.cwd()): ReportConfig {
  const config = readRepoConfig(root)
  const seriesIndex = resolve(root, SERIES_INDEX_PATH)
  return buildReportConfig(root, config, readSeriesEntry(seriesIndex, seriesKey))
}

/**
 * テストが実データの有無で`describe`ブロックごとスキップするための入口。読むシリーズは環境変数`SERIES_KEY`で
 * 明示する。未設定なら実データなしとして扱い、設定されていれば`loadReportConfig`と同じ経路で読む。
 *
 * @param root リポジトリルート。既定はカレントディレクトリ。
 * @returns `config`は`hasSeriesConfig`がtrueのときのみ意味を持つ。
 * @throws `SERIES_KEY`のシリーズが無い、または設定が読めなければ止める（`loadReportConfig`）。
 */
export function tryLoadReportConfig(root: string = process.cwd()): {
  hasSeriesConfig: boolean
  config: ReportConfig
} {
  const seriesKey = process.env.SERIES_KEY
  if (seriesKey === undefined || seriesKey === '') {
    return { hasSeriesConfig: false, config: undefined as unknown as ReportConfig }
  }
  return { hasSeriesConfig: true, config: loadReportConfig(seriesKey, root) }
}

/**
 * スコープの表示名のプレースホルダー。表示名はmicroCMSの`series.scopeList`で解決する。
 *
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns `{scopeList.label:N}`（Nはスコープid）。
 */
export function scopeLabel(scope: number): string {
  return `{scopeList.label:${scope}}`
}

/**
 * スコープの表示名のプレースホルダーをid昇順で。設定ファイル上の並びには依存しない。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns プレースホルダーの配列（id昇順）。
 */
export function scopeLabelList(config: ReportConfig): string[] {
  return [...config.scopeList].sort((a, b) => a.id - b.id).map(scope => scopeLabel(scope.id))
}

/**
 * `scopeList[].file`をディレクトリ配下の絶対パスに解決する。`file`は設定ファイル由来なので、
 * 絶対パスや`../`でディレクトリの外を指していないことをここで確かめる（読み出しも書き戻しも同じ検査を使う）。
 *
 * @param directory 基準ディレクトリ（原資料ディレクトリ、または書き戻しの出力先）。
 * @param file 基準ディレクトリからの相対ファイル名。
 * @returns 絶対パス。
 * @throws `file`が絶対パス、または基準ディレクトリの外を指していれば止める。
 */
export function scopeFilePath(directory: string, file: string): string {
  ensure(!isAbsolute(file), `scope file must be a relative path: ${file}`)
  const base = resolve(directory)
  const target = resolve(base, file)
  const inside = relative(base, target)
  ensure(
    inside !== '' && !inside.startsWith('..') && !isAbsolute(inside),
    `scope file must stay inside its directory: ${file}`
  )
  return target
}

/**
 * スコープの原資料ファイル（1スコープ＝1ファイル）の絶対パス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パス。
 * @throws 設定に無いスコープid、または`file`が原資料ディレクトリの外を指していれば止める。
 */
export function scopeSourcePath(config: ReportConfig, scope: number): string {
  const entry = config.scopeList.find(candidate => candidate.id === scope)
  if (entry === undefined) {
    throw new Error(`Unknown scope: ${scope}`)
  }
  return scopeFilePath(config.pathList.editedSource, entry.file)
}
