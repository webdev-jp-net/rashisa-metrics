/**
 * @file シリーズごとの閲覧可否。許可リストの正本はmicroCMSの`series.allowList`で、ユーザーが管理画面で書く。
 */
import type { Session } from 'next-auth'

/**
 * 許可リストのテキストを1行1件に分ける。前後の空白と大文字・小文字の違いは無視し、空行は捨てる。
 *
 * @param text `series.allowList`の本文。未設定なら空配列を返す。
 * @returns 小文字化した許可エントリの一覧。
 */
function parseAllowList(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map(line => line.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * 閲覧者がそのシリーズのレポートを閲覧してよいかを判定する。許可リストが空・未設定のシリーズは、
 * 未ログインでも通す。それ以外は、`@`を含むエントリはメールアドレスの完全一致、含まないエントリはドメイン一致として扱う。
 *
 * @param session サインイン中のセッション。未ログインならnull。
 * @param allowListText `series.allowList`の本文。
 * @returns 閲覧してよければtrue。
 */
export function isAllowedViewer(
  session: Session | null,
  allowListText: string | undefined
): boolean {
  const entryList = parseAllowList(allowListText)
  if (entryList.length === 0) return true

  const email = session?.user?.email?.toLowerCase()
  if (!email) return false

  const domain = email.slice(email.lastIndexOf('@') + 1)

  return entryList.some(entry => (entry.includes('@') ? entry === email : entry === domain))
}
