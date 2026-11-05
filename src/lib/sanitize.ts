/** @file microCMSのリッチテキスト（HTML）を画面に埋め込む前のサニタイズ。 */
import DOMPurify from 'isomorphic-dompurify'

/**
 * スクリプトなど危険なタグ・属性を取り除く。リンクの「新しいタブで開く」指定（`target`）は既定の設定では
 * 消えるため、残すよう指定する。
 *
 * @param html microCMSから届いたHTML。
 * @returns サニタイズ済みのHTML。
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
}
