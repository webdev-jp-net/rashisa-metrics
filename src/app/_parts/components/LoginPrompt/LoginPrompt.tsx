'use client'

import styles from './LoginPrompt.module.scss'
import { useLoginPrompt, type LoginPromptState } from './useLoginPrompt'

/** 手書き風リンク（`.hint`）の書体。design-system.md「書体」の手書き風書体と同じスタック。 */
const HINT_FONT = { fontFamily: "'Zen Kurenaido',var(--font-head)" }

export interface LoginPromptProps {
  state: LoginPromptState
  siteTitle: string
  siteLead: string
}

/**
 * レポートの代わりに出す画面。未ログインならログインを促し、ログイン済みでも許可リストに無ければ
 * 閲覧権限がないことを伝えてログアウトへ導く。`HeroSection`と同じ`.box`／`.copy`の構成
 * （サイトタイトル・リード文を含む）を使う。
 *
 * @param props
 * @param props.state 未ログイン（`signedOut`）か、ログイン済みで非許可（`notAllowed`）か。
 * @param props.siteTitle サイトタイトル。
 * @param props.siteLead サイトのリード文。
 * @returns 描画結果。
 */
export function LoginPrompt({ state, siteTitle, siteLead }: LoginPromptProps) {
  const { message, actionLabel, handleClick } = useLoginPrompt(state)

  return (
    <main>
      <div className={styles.box}>
        <div className={styles.copy}>
          <header>
            <h1>{siteTitle}</h1>
            <p className={styles.lead}>{siteLead}</p>
          </header>
          {message.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <button type="button" className={styles.hint} style={HINT_FONT} onClick={handleClick}>
          <span>{actionLabel}</span>
        </button>
      </div>
    </main>
  )
}
