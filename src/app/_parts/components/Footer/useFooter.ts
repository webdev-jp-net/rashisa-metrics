import type { MouseEvent } from 'react'
import { signOut } from 'next-auth/react'

/**
 * フッターのログアウト操作。リンクの既定の遷移（NextAuthのサインアウト画面）は止め、
 * その場でサインアウトしてページを読み直させる。修飾キー付き・中クリックは、新規タブで開く等の
 * ブラウザ標準の挙動を優先し、何もしない。
 *
 * @returns ログアウトリンクのクリックハンドラー。
 */
export function useFooter() {
  const handleSignOut = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return
    }
    event.preventDefault()
    void signOut()
  }

  return { handleSignOut }
}
