import { signIn, signOut } from 'next-auth/react'

/** ルートのタイトル・リード文・段落。ログインの有無にかかわらず同じ。 */
const COPY = {
  title: 'RASHISAメトリクス',
  lead: '「らしさ」を数値的・客観的に観測する',
  paragraph: 'お手本と編集対象の文体を解析したレポートです。',
}

/**
 * ルートの文言とボタン操作。未ログインならGoogleのサインインへ送ってルートへ戻し、
 * ログイン済みならサインアウトへ送る。
 *
 * @returns 表示する文言と、ログイン・ログアウトのクリックハンドラー。
 */
export function useSeriesIndex() {
  const handleSignIn = () => {
    void signIn('google', { callbackUrl: window.location.origin + '/' })
  }
  const handleSignOut = () => {
    void signOut()
  }

  return { ...COPY, handleSignIn, handleSignOut }
}
