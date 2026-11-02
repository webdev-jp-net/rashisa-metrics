import { existsSync } from 'node:fs'
import { basename, relative } from 'node:path'
import {
  chapterProfilePath,
  editedProfilePath,
  loadStylometricProfile,
  modelProfilePath,
} from '../data/profiles'
import { deepEqual, saveJson } from '../revision/io'
import type { RevisionContext } from '../revision/measure'
import { buildProfile } from './profile'
import { editedDocumentList, modelDocumentList, scopeDocument, sortedScopeIdList } from './sources'
import type { ExtractedProfile, PrepareResult, ProfileCheck } from './types'

/** 保存済みプロファイルでは`meta`配下にあるが、中身は計測結果そのものであるフィールド。 */
const MEASURED_META_KEY_LIST = ['corpusSize', 'measurement']

/** 作成するプロファイル1件と、その保存先。 */
interface ProfileEntry {
  /** 絶対パス。 */
  path: string
  profile: ExtractedProfile
}

/**
 * お手本1件・編集対象の全体1件・スコープ別（スコープ数と同数）を計測する。
 *
 * @param ctx 設定と解析器。
 * @returns プロファイルと保存先（お手本→編集対象の全体→スコープid昇順）。
 * @throws 原資料が読めない、または空の文書があれば止める。
 */
function measureProfileList(ctx: RevisionContext): ProfileEntry[] {
  const { config } = ctx
  const { model, edited } = config.anonymization
  const entryList: ProfileEntry[] = [
    {
      path: modelProfilePath(config),
      profile: buildProfile(ctx, {
        register: basename(config.pathList.modelProfile),
        sourceDir: config.pathList.modelSource,
        documentList: modelDocumentList(config),
        anonymization: model,
      }),
    },
    {
      path: editedProfilePath(config),
      profile: buildProfile(ctx, {
        register: basename(config.pathList.editedProfile),
        sourceDir: config.pathList.editedSource,
        documentList: editedDocumentList(config),
        anonymization: edited,
      }),
    },
  ]
  for (const scope of sortedScopeIdList(config)) {
    entryList.push({
      path: chapterProfilePath(config, scope),
      profile: buildProfile(ctx, {
        register: basename(config.pathList.editedScopeProfile.replace('{scope}', String(scope))),
        sourceDir: config.pathList.editedSource,
        documentList: [scopeDocument(config, scope)],
        anonymization: edited,
      }),
    })
  }
  return entryList
}

/**
 * 計測し直したプロファイルを保存済みのものと突き合わせる。数値が変わったのか`meta`の形だけが変わったのかを
 * 分けて見られるよう、指標側（`corpusSize`・`measurement`を含む）と`meta`のその他を別に数える。
 *
 * @param root リポジトリルート。
 * @param entry 計測し直したプロファイルと保存先。
 * @returns 照合結果（一致していれば`measured`・`meta`とも空）。
 */
function checkProfile(root: string, entry: ProfileEntry): ProfileCheck {
  const check: ProfileCheck = {
    register: entry.profile.meta.register,
    path: relative(root, entry.path),
    exists: existsSync(entry.path),
    measured: [],
    meta: [],
  }
  if (!check.exists) return check

  const saved = loadStylometricProfile(entry.path).stylometricProfile
  const savedRecord = saved as unknown as Record<string, unknown>
  const builtRecord = entry.profile as unknown as Record<string, unknown>
  for (const key of new Set([...Object.keys(builtRecord), ...Object.keys(savedRecord)])) {
    if (key === 'meta') continue
    if (!deepEqual(builtRecord[key], savedRecord[key])) check.measured.push(key)
  }

  const savedMeta = saved.meta as unknown as Record<string, unknown>
  const builtMeta = entry.profile.meta as unknown as Record<string, unknown>
  for (const key of MEASURED_META_KEY_LIST) {
    if (!deepEqual(builtMeta[key], savedMeta[key])) check.measured.push(key)
  }
  for (const key of new Set([...Object.keys(builtMeta), ...Object.keys(savedMeta)])) {
    if (MEASURED_META_KEY_LIST.includes(key)) continue
    if (!deepEqual(builtMeta[key], savedMeta[key])) check.meta.push(key)
  }
  return check
}

/** `prepare`の引数。`check`のときは1件も書き込まない。 */
export interface PrepareOptions {
  check?: boolean
}

/**
 * 抽出処理の計測工程。原資料から文体プロファイル一式を作り、保存するか、保存済みのものと突き合わせる。
 *
 * @param ctx 設定と解析器。
 * @param options `check`がtrueなら照合だけを行い、ファイルへは書き込まない。
 * @returns 書き出したパス、または照合結果。
 * @throws 原資料が読めない、または空の文書があれば止める。
 */
export function prepare(ctx: RevisionContext, options: PrepareOptions = {}): PrepareResult {
  const entryList = measureProfileList(ctx)
  if (options.check === true) {
    return { written: [], checkList: entryList.map(entry => checkProfile(ctx.config.root, entry)) }
  }
  for (const entry of entryList) {
    saveJson(entry.path, { stylometricProfile: entry.profile })
  }
  return { written: entryList.map(entry => entry.path), checkList: [] }
}

/**
 * 照合結果のうち不一致だったもの。`--check`の終了コードを決めるのに使う。
 *
 * @param checkList `prepare`の照合結果。
 * @returns 保存済みプロファイルが無い、または不一致フィールドがあるもの。
 */
export function mismatchedCheckList(checkList: ProfileCheck[]): ProfileCheck[] {
  return checkList.filter(
    check => !check.exists || check.measured.length > 0 || check.meta.length > 0
  )
}
