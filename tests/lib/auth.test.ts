import { describe, expect, test } from 'bun:test'
import type { Account, Profile, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import { authOption } from '@/lib/auth'

/**
 * サインイン直後のGoogleアカウント情報。
 *
 * @param emailVerified Googleが返す`email_verified`。
 * @returns `user`・`account`・`profile`の組。
 */
function googleSignIn(emailVerified: boolean): { user: User; account: Account; profile: Profile } {
  const user: User = { id: 'sub', email: 'viewer@example.com', name: '閲覧者' }
  return {
    user,
    account: { provider: 'google', type: 'oauth', providerAccountId: 'sub' },
    profile: {
      sub: 'sub',
      email: 'viewer@example.com',
      name: '閲覧者',
      email_verified: emailVerified,
    } as Profile,
  }
}

describe('authOption.callbacks.jwt', () => {
  const jwt = authOption.callbacks?.jwt
  if (!jwt) throw new Error('expected callbacks.jwt to be defined')

  /**
   * NextAuthはjwtコールバックを呼ぶ前に、サインインしたメールを`token.email`へ既定値として
   * 埋めている（`node_modules/next-auth/core/routes/callback.js`の`defaultToken`）。
   * このテストもその前提を再現しないと、「falseなのに上書きし忘れて前の値が残る」バグを検出できない。
   */
  const tokenWithDefaultEmail = (): JWT => ({ email: 'viewer@example.com' }) as JWT

  test('email_verifiedがtrueならメールをトークンへ写す', async () => {
    const { user, account, profile } = googleSignIn(true)
    const token = await jwt({
      token: tokenWithDefaultEmail(),
      user,
      account,
      profile,
      trigger: 'signIn',
    })
    expect(token.email).toBe('viewer@example.com')
  })

  test('email_verifiedがfalseなら、既定値で埋まっていたメールも消して抜け道にしない', async () => {
    const { user, account, profile } = googleSignIn(false)
    const token = await jwt({
      token: tokenWithDefaultEmail(),
      user,
      account,
      profile,
      trigger: 'signIn',
    })
    expect(token.email).toBeUndefined()
  })
})
