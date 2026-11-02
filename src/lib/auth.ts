/**
 * @file Googleサインインの設定（NextAuth）。誰でもサインインでき、閲覧してよいかは
 *   `src/lib/permission.ts`の許可リスト照合がページ側で判定する。
 */
import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

/**
 * NextAuthの設定。`GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET`・`NEXTAUTH_SECRET`を実行時に読む。
 * 未設定でもビルドを止めないよう、providerの値は空文字にフォールバックする。
 */
export const authOption: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      // サインアウトはアプリ側のセッションだけを終える。ブラウザ内のGoogle自体のログインは
      // 残ったままなので、指定が無いとGoogleがアカウント選択画面を出さず直前のアカウントで
      // 自動的に再認証してしまい、別アカウントに切り替えられなくなる。
      authorization: { params: { prompt: 'select_account' } },
    }),
  ],
  callbacks: {
    /**
     * サインイン自体は誰にでも許す。閲覧可否は許可リストで判定するため、ここでは弾かない。
     *
     * @returns 常にtrue。
     */
    async signIn() {
      return true
    },
    /**
     * サインイン直後にGoogleのプロフィールからメール・名前・アイコンをトークンへ写す。
     * セッションはJWTだけで持つので、以後のリクエストではこのトークンが情報源になる。
     * 許可リストのドメイン一致は本人確認済みのメールだけを対象にするため、`email_verified`が
     * `true`のときだけメールを写す。NextAuthはこのコールバックを呼ぶ前に`token.email`へ
     * サインインしたメールを既定値として埋めているため、`false`のときは明示的に`undefined`で
     * 上書きしないと、未確認のメールがそのまま残って許可リストに通ってしまう。
     *
     * @param params NextAuthのjwtコールバック引数。
     * @param params.token 現在のトークン。
     * @param params.account サインイン直後だけ渡るアカウント情報。
     * @param params.profile サインイン直後だけ渡るプロフィール。
     * @returns 更新後のトークン。
     */
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const googleProfile = profile as { picture?: string; email_verified?: boolean }
        token.email = googleProfile.email_verified === true ? profile.email : undefined
        token.name = profile.name
        token.image = googleProfile.picture
      }
      return token
    },
    /**
     * トークンの値をセッションへ写す。許可リスト照合が読むのは`session.user.email`。
     *
     * @param params NextAuthのsessionコールバック引数。
     * @param params.session 現在のセッション。
     * @param params.token JWTコールバックが返したトークン。
     * @returns 更新後のセッション。
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.image = token.image as string
      }
      return session
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
