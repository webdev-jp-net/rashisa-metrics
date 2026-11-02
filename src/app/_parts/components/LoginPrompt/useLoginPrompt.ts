import { signIn, signOut } from 'next-auth/react'

/** ログイン促し画面の2状態。未ログインか、ログイン済みだが許可リストに無いか。 */
export type LoginPromptState = 'signedOut' | 'notAllowed'

/** シリーズの閲覧制限を説明する段落。両状態で共通。 */
const RESTRICTION_NOTICE =
  'このレポートは限定公開です。権限のあるアカウントでログインすると閲覧できます。'

/** 状態ごとの文言（段落の配列）とボタンラベル。 */
const COPY: Record<LoginPromptState, { message: string[]; actionLabel: string }> = {
  signedOut: {
    message: [RESTRICTION_NOTICE],
    actionLabel: 'ログインする',
  },
  notAllowed: {
    message: [
      RESTRICTION_NOTICE,
      '閲覧権限がないアカウントでログインしているため、ご覧いただけません。',
    ],
    actionLabel: 'ログアウトする',
  },
}

/**
 * ログイン促し画面の文言とボタン操作。未ログインならGoogleのサインインへ、非許可ならサインアウトへ送る。
 *
 * @param state どちらの状態か。
 * @returns 表示する文言・ボタンラベルと、ボタンのクリックハンドラー。
 */
export function useLoginPrompt(state: LoginPromptState) {
  const handleClick = () => {
    if (state === 'signedOut') {
      // signInはcallbackUrlを省略すると現在のURL（ハッシュ込み）へ戻る。ログイン前のハッシュは
      // 未ログイン画面を開いていた時点のもので、ログイン後のスコープ選択としては意味を持たないため、
      // 戻り先からは取り除く。
      const callbackUrl = window.location.origin + window.location.pathname + window.location.search
      void signIn('google', { callbackUrl })
      return
    }
    void signOut()
  }

  return { ...COPY[state], handleClick }
}
