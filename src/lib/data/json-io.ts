import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * JSONファイルを読んで`T`として返す。実行時の検証は行わない。
 *
 * @param path JSONファイルのパス。
 * @returns パース結果を`T`として。
 */
export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

/**
 * ファイルのバイト列のsha256。`sourceHashList`（入力の変化検知）に使う。
 *
 * @param path ファイルのパス。
 * @returns 16進のハッシュ。
 */
export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * UTF-8文字列のsha256。スコープ本文の原文・改稿の照合（`originalTextSha256`等）に使う。
 *
 * @param text ハッシュ対象の文字列。
 * @returns 16進のハッシュ。
 */
export function sha256String(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * 書き出すJSONの整形（インデント・末尾改行）を全CLIで揃える。`build-report`の`--check`（再生成結果を保存済みファイルと照合する引数）は文字列一致で比較する。
 *
 * @param value 書き出す値。
 * @returns 整形済みJSON文字列（末尾改行付き）。
 */
export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
