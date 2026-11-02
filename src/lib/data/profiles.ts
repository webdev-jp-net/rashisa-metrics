import { join } from 'node:path';
import type { ReportConfig } from '../config/report-config';
import { readJson } from './json-io';
import type { StylometricProfileFile } from './types';

/**
 * 文体プロファイル1件を読む。パスは`modelProfilePath`・`editedProfilePath`・`chapterProfilePath`で求める。
 *
 * @param path `stylometric_profile.json`のパス。
 * @returns ファイル内容。
 */
export function loadStylometricProfile(path: string): StylometricProfileFile {
  return readJson<StylometricProfileFile>(path);
}

/**
 * お手本媒体の文体プロファイルのパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 絶対パス。
 */
export function modelProfilePath(config: ReportConfig): string {
  return join(config.pathList.modelProfile, 'stylometric_profile.json');
}

/**
 * 編集対象媒体（全体）の文体プロファイルのパス。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 絶対パス。
 */
export function editedProfilePath(config: ReportConfig): string {
  return join(config.pathList.editedProfile, 'stylometric_profile.json');
}

/**
 * 編集対象媒体のスコープ別文体プロファイルのパス。設定の`{scope}`をスコープidで置換する。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns 絶対パス。
 */
export function chapterProfilePath(config: ReportConfig, scope: number): string {
  return join(
    config.pathList.editedScopeProfile.replace('{scope}', String(scope)),
    'stylometric_profile.json'
  );
}

/**
 * お手本媒体の文体プロファイル。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns ファイル内容。
 */
export function loadModelProfile(config: ReportConfig): StylometricProfileFile {
  return loadStylometricProfile(modelProfilePath(config));
}

/**
 * 編集対象媒体（全体）の文体プロファイル。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns ファイル内容。
 */
export function loadEditedProfile(config: ReportConfig): StylometricProfileFile {
  return loadStylometricProfile(editedProfilePath(config));
}

/**
 * 編集対象媒体の1スコープ分の文体プロファイル。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @returns ファイル内容。
 */
export function loadChapterProfile(config: ReportConfig, scope: number): StylometricProfileFile {
  return loadStylometricProfile(chapterProfilePath(config, scope));
}

/**
 * 編集対象媒体のスコープ別文体プロファイルを、設定`scopeList`のid昇順で全件。
 *
 * @param config 設定（`loadReportConfig`の結果）。
 * @returns 設定`scopeList`と同じ件数（スコープid順）。
 */
export function loadChapterProfileList(config: ReportConfig): StylometricProfileFile[] {
  const idList = [...config.scopeList].sort((a, b) => a.id - b.id).map(scope => scope.id);
  return idList.map(scope => loadChapterProfile(config, scope));
}
