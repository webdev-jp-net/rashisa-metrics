import { describe, expect, test } from 'bun:test'
import type { Session } from 'next-auth'
import { isAllowedViewer } from '@/lib/permission'

/**
 * サインイン済みのセッションを作る。判定が読むのはメールアドレスだけなので、他は固定値でよい。
 *
 * @param email サインイン中のメールアドレス。
 * @returns セッション。
 */
function session(email: string): Session {
  return { user: { name: '閲覧者', email, image: null }, expires: '2100-01-01T00:00:00.000Z' }
}

describe('isAllowedViewer', () => {
  test('メールアドレスの完全一致だけを通す', () => {
    const allowList = 'viewer@example.com'
    expect(isAllowedViewer(session('viewer@example.com'), allowList)).toBe(true)
    expect(isAllowedViewer(session('other@example.com'), allowList)).toBe(false)
    // 前方一致・部分一致では通さない
    expect(isAllowedViewer(session('viewer@example.com.example.net'), allowList)).toBe(false)
  })

  test('`@`を含まない行はドメイン一致として扱う', () => {
    const allowList = 'example.com'
    expect(isAllowedViewer(session('anyone@example.com'), allowList)).toBe(true)
    expect(isAllowedViewer(session('anyone@other.example.com'), allowList)).toBe(false)
    expect(isAllowedViewer(session('anyone@example.net'), allowList)).toBe(false)
  })

  test('メールアドレスに`@`が複数あっても、最後の`@`以降をドメインとする', () => {
    expect(isAllowedViewer(session('a@b@example.com'), 'example.com')).toBe(true)
    expect(isAllowedViewer(session('a@b@example.com'), 'b')).toBe(false)
  })

  test('先頭に`@`を付けた行はドメイン一致でなくメール完全一致として扱われる', () => {
    // ユーザーが誤ってドメインのつもりで書いた場合、意図通りには一致しない
    expect(isAllowedViewer(session('anyone@example.com'), '@example.com')).toBe(false)
  })

  test('大文字・小文字の違いを無視する', () => {
    expect(isAllowedViewer(session('Viewer@Example.COM'), 'viewer@example.com')).toBe(true)
    expect(isAllowedViewer(session('viewer@example.com'), 'VIEWER@EXAMPLE.COM')).toBe(true)
    expect(isAllowedViewer(session('Anyone@Example.COM'), 'Example.Com')).toBe(true)
  })

  test('各行の前後の空白を無視する', () => {
    expect(isAllowedViewer(session('viewer@example.com'), '  viewer@example.com\t')).toBe(true)
    expect(isAllowedViewer(session('anyone@example.com'), ' example.com ')).toBe(true)
  })

  test('空行を無視する', () => {
    const allowList = '\n\n   \nviewer@example.com\n\n  \n'
    expect(isAllowedViewer(session('viewer@example.com'), allowList)).toBe(true)
    // 空行がすべてのメールアドレスを通す抜け道にならない
    expect(isAllowedViewer(session('other@example.net'), allowList)).toBe(false)
  })

  test('複数行のうち1件でも一致すれば通す', () => {
    const allowList = 'first@example.com\nexample.net\r\nsecond@example.org'
    expect(isAllowedViewer(session('first@example.com'), allowList)).toBe(true)
    expect(isAllowedViewer(session('anyone@example.net'), allowList)).toBe(true)
    expect(isAllowedViewer(session('second@example.org'), allowList)).toBe(true)
    expect(isAllowedViewer(session('third@example.info'), allowList)).toBe(false)
  })

  test('許可リストが空・空白だけ・未定義なら未ログインを含め誰でも通す', () => {
    expect(isAllowedViewer(session('viewer@example.com'), '')).toBe(true)
    expect(isAllowedViewer(session('viewer@example.com'), '\n  \n')).toBe(true)
    expect(isAllowedViewer(session('viewer@example.com'), undefined)).toBe(true)
    expect(isAllowedViewer(null, '')).toBe(true)
    expect(isAllowedViewer(null, undefined)).toBe(true)
  })

  test('未ログイン、またはメールアドレスを持たないセッションは通さない', () => {
    expect(isAllowedViewer(null, 'viewer@example.com')).toBe(false)
    expect(isAllowedViewer(null, 'example.com')).toBe(false)
    expect(isAllowedViewer({ expires: '2100-01-01T00:00:00.000Z' }, 'example.com')).toBe(false)
    expect(
      isAllowedViewer({ user: { email: null }, expires: '2100-01-01T00:00:00.000Z' }, 'example.com')
    ).toBe(false)
  })
})
