'use client'

import styles from './Footer.module.scss'
import { useFooter } from './useFooter'

/** JavaScriptが動かない場合の遷移先。NextAuthがこの経路にサインアウト画面を持つ。 */
const SIGN_OUT_HREF = '/api/auth/signout'

/**
 * ページ末尾のフッター。ログアウト操作だけを持つ。ScopeNavとは異なり画面上端には追従しない
 * （このフッターはレポートを表示中で、ログインしている閲覧者にだけ描画する）。
 *
 * @returns 描画結果。
 */
export function Footer() {
  const { handleSignOut } = useFooter()

  return (
    <footer className={styles.footer}>
      <a className={styles.logout} href={SIGN_OUT_HREF} onClick={handleSignOut}>
        ログアウト
      </a>
    </footer>
  )
}
