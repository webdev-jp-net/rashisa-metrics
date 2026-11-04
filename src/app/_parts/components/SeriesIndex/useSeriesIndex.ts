import { signIn, signOut } from 'next-auth/react'

/** ルートの文言。ログインの有無にかかわらず同じ。 */
const COPY = {
  title: 'RASHISAメトリクス',
  lead: '「らしさ」を数値的・客観的に観測する',
  /** 段落の行。行の間に改行（`<br>`）を入れる。 */
  paragraphLineList: [
    'お手本と編集対象の文章を比較して、文体を解析する4つの観点のデータを抽出し',
    '数値的に近づけた場合の実例を提案しています。',
  ],
  reportHeading: 'レポート：',
  authNote: '一部のレポートは限定公開です。権限のあるアカウントでログインすると閲覧できます。',
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
