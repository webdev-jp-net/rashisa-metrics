'use client'

import type { KeyboardEvent, RefObject } from 'react'
import type { ScopeModel } from '../../model/types'
import styles from './ScopeNav.module.scss'

export interface ScopeNavProps {
  title: string
  scopeList: ScopeModel[]
  selected: string
  stuck: boolean
  navRef: RefObject<HTMLDivElement | null>
  tabRefList: RefObject<Record<string, HTMLButtonElement | null>>
  onSelect: (key: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, key: string) => void
}

/**
 * スコープのタブ一覧。画面上端に固定され、張り付いたときに見た目が変わる。
 *
 * @param props
 * @param props.title ナビの見出し。
 * @param props.scopeList 全スコープ。
 * @param props.selected 選択中のスコープの`key`。
 * @param props.stuck 画面上端に張り付いているか。
 * @param props.navRef ナビ要素。張り付き検知に使う。
 * @param props.tabRefs タブのボタン要素。矢印キー移動でフォーカスするため。
 * @param props.onSelect タブのクリック。
 * @param props.onKeyDown タブのキー操作。
 * @returns 描画結果。
 */
export function ScopeNav({
  title,
  scopeList,
  selected,
  stuck,
  navRef,
  tabRefList,
  onSelect,
  onKeyDown,
}: ScopeNavProps) {
  return (
    <div ref={navRef} className={`${styles.wrap} ${stuck ? styles.stuck : ''}`}>
      <div className={styles.bar}>
        <div className={styles.tabs}>
          <a className={styles.title} href="#top">
            {title}
          </a>
          <div className={styles.list} role="tablist" aria-label="スコープ">
            {scopeList.map(scope => (
              <button
                key={scope.key}
                ref={element => {
                  tabRefList.current[scope.key] = element
                }}
                type="button"
                role="tab"
                id={`tab-${scope.panelId}`}
                aria-controls={scope.panelId}
                aria-selected={scope.key === selected}
                tabIndex={scope.key === selected ? 0 : -1}
                onClick={() => onSelect(scope.key)}
                onKeyDown={event => onKeyDown(event, scope.key)}
              >
                {scope.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
