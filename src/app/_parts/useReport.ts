'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import type { DiffRow, DiffFoldRow } from '@/lib/diff'
import type { ScopeModel, ViewpointKey } from './model/types'

/** 観点タブの並び。矢印キー移動の順序。 */
const VIEWPOINT_ORDER: ViewpointKey[] = ['lsm', 'endings', 'politeness', 'length']

/** 折りたたみ行の「さらに表示」1回で開く行数。 */
const FOLD_STEP = 10

/**
 * タブの矢印キー移動先。端で折り返す（WAI-ARIAのタブ操作）。
 *
 * @param event キーイベント。
 * @param index 現在のタブのindex。
 * @param length タブ数。
 * @returns 矢印キー以外ならnull。
 */
function nextIndex(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  length: number
): number | null {
  if (event.key === 'ArrowRight') return (index + 1) % length
  if (event.key === 'ArrowLeft') return (index - 1 + length) % length
  return null
}

/** ページ全体の操作状態（選択中スコープ・観点・フィルタ・固定ナビ）と、各部品に渡すハンドラ。 */
export interface UseReportResult {
  scope: string
  selectScope: (key: string, pushHash?: boolean) => void
  onScopeKeyDown: (event: KeyboardEvent<HTMLButtonElement>, key: string) => void
  scopeTabRefList: RefObject<Record<string, HTMLButtonElement | null>>
  /** スコープタブ本体（`tab-report-{scope}`）をクリックし、通常のタブ選択処理をそのまま経由させる。 */
  activateScopeTab: (key: string) => void
  viewpointOf: (scopeKey: string) => ViewpointKey
  selectViewpoint: (scopeKey: string, viewpoint: ViewpointKey) => void
  onViewpointKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    scopeKey: string,
    viewpoint: ViewpointKey
  ) => void
  viewpointTabRefList: RefObject<Record<string, HTMLButtonElement | null>>
  filter: string
  setFilter: (view: string) => void
  stuck: boolean
  navRef: RefObject<HTMLDivElement | null>
  /** ビューポート全体を占める2つのセクション。scroll-driven animation非対応時の`--out`フォールバックに使う。 */
  viewportSectionRefList: RefObject<HTMLDivElement | null>[]
}

/**
 * ページ全体の状態。スコープ選択はURLハッシュと同期し、戻る/進むでも切り替わる。
 *
 * @param scopeList 全スコープの表示モデル。先頭が初期選択。
 * @returns 状態とハンドラ。
 */
export function useReport(scopeList: ScopeModel[]): UseReportResult {
  const panelToScope = useMemo(
    () => new Map(scopeList.map(scope => [scope.panelId, scope.key])),
    [scopeList]
  )
  const [scope, setScope] = useState(scopeList[0].key)
  const [viewpointList, setViewpointList] = useState<Record<string, ViewpointKey>>({})
  const [filter, setFilter] = useState('main')
  const [stuck, setStuck] = useState(false)
  const scopeTabRefList = useRef<Record<string, HTMLButtonElement | null>>({})
  const viewpointTabRefList = useRef<Record<string, HTMLButtonElement | null>>({})
  const navRef = useRef<HTMLDivElement | null>(null)
  const topSectionRef = useRef<HTMLDivElement | null>(null)
  const introSectionRef = useRef<HTMLDivElement | null>(null)
  const viewportSectionRefList = useMemo(() => [topSectionRef, introSectionRef], [])

  const selectScope = useCallback(
    (key: string, pushHash = false) => {
      setScope(key)
      if (!pushHash) return
      const id = `#report-${key}`
      if (window.location.hash !== id) window.history.pushState(null, '', id)
    },
    [setScope]
  )

  const onScopeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
      const index = scopeList.findIndex(entry => entry.key === key)
      const target = nextIndex(event, index, scopeList.length)
      if (target === null) return
      event.preventDefault()
      const nextKey = scopeList[target].key
      scopeTabRefList.current[nextKey]?.focus()
      selectScope(nextKey, true)
    },
    [scopeList, selectScope]
  )

  const activateScopeTab = useCallback((key: string) => {
    document.getElementById(`tab-report-${key}`)?.click()
  }, [])

  const viewpointOf = useCallback(
    (scopeKey: string): ViewpointKey => viewpointList[scopeKey] ?? VIEWPOINT_ORDER[0],
    [viewpointList]
  )

  const selectViewpoint = useCallback((scopeKey: string, viewpoint: ViewpointKey) => {
    setViewpointList(current => ({ ...current, [scopeKey]: viewpoint }))
  }, [])

  const onViewpointKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, scopeKey: string, viewpoint: ViewpointKey) => {
      const index = VIEWPOINT_ORDER.indexOf(viewpoint)
      const target = nextIndex(event, index, VIEWPOINT_ORDER.length)
      if (target === null) return
      event.preventDefault()
      const next = VIEWPOINT_ORDER[target]
      viewpointTabRefList.current[`${scopeKey}-${next}`]?.focus()
      selectViewpoint(scopeKey, next)
    },
    [selectViewpoint]
  )

  // 読み込み時と戻る/進むの際は、URLハッシュをスコープの正とする。
  useEffect(() => {
    const syncFromHash = () => {
      const id = window.location.hash.slice(1)
      setScope(panelToScope.get(id) ?? scopeList[0].key)
    }
    window.addEventListener('popstate', syncFromHash)
    syncFromHash()
    return () => window.removeEventListener('popstate', syncFromHash)
  }, [panelToScope, scopeList])

  // sticky要素が画面上端に張り付いたかを検知する。rootMarginを-1pxにすると、張り付いた瞬間に1px分はみ出して
  // intersectionRatioが1を切るので、それをstuckの合図にする
  useEffect(() => {
    const element = navRef.current
    if (!element) return
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry.intersectionRatio < 1 && entry.boundingClientRect.top <= 0),
      { threshold: [0, 1], rootMargin: '-1px 0px 0px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useViewportFade(viewportSectionRefList)

  return {
    scope,
    selectScope,
    onScopeKeyDown,
    scopeTabRefList,
    activateScopeTab,
    viewpointOf,
    selectViewpoint,
    onViewpointKeyDown,
    viewpointTabRefList,
    filter,
    setFilter,
    stuck,
    navRef,
    viewportSectionRefList,
  }
}

/**
 * 選択されていないタブパネルも`hidden="until-found"`としてDOMに残し、ページ内検索から見つけられるようにする。
 * React 19は`hidden`を真偽値の属性としてしか出力しない（サーバーHTMLは`hidden=""`になる）ため、文字列値は
 * ここで描画前に設定し直す。マッチした際はブラウザの`beforematch`イベントでタブ一覧側に通知する。
 *
 * @param selected 選択中か。
 * @param onFound ページ内検索で見つかったときの通知。
 * @returns パネル要素に付けるref。
 */
export function useTabPanel(selected: boolean, onFound: () => void) {
  const ref = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (selected) element.removeAttribute('hidden')
    else element.setAttribute('hidden', 'until-found')
  }, [selected])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const handler = () => onFound()
    element.addEventListener('beforematch', handler)
    return () => element.removeEventListener('beforematch', handler)
  }, [onFound])

  return ref
}

/**
 * 図がビューポートに入った最初の1回だけ、棒グラフが伸びるアニメーションを再生する。
 *
 * @returns 要素に付けるrefと、一度でも表示領域に入ったか。
 */
export function useInView<T extends HTMLElement>(): { ref: RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entryList, self) => {
        for (const entry of entryList) {
          if (!entry.isIntersecting) continue
          setInView(true)
          self.unobserve(entry.target)
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, inView }
}

/**
 * ビューポート全体を占めるセクションのフェード量。scroll-driven animationに対応したブラウザはCSSの
 * `section-out`キーフレームで処理するため、このobserverは非対応のブラウザの分だけを補う。
 *
 * @param refList ビューポート全体を占めるセクションの要素。
 */
export function useViewportFade(refList: RefObject<HTMLElement | null>[]): void {
  useEffect(() => {
    if (CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) return
    const sectionList = refList.flatMap(ref => (ref.current ? [ref.current] : []))
    const observer = new IntersectionObserver(
      entryList => {
        for (const entry of entryList) {
          const rect = entry.boundingClientRect
          const height = rect.height || 1
          const out = Math.min(1, Math.max(0, -rect.top / (height * 0.6)))
          ;(entry.target as HTMLElement).style.setProperty('--out', out.toFixed(3))
        }
      },
      { threshold: Array.from({ length: 101 }, (_, index) => index / 100) }
    )
    sectionList.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [refList])
}

/** diff提案1件の折りたたみ状態。 */
export interface DiffFoldState {
  expanded: boolean
  /** 各折りたたみ行から既に表示済みの行数。`rowList`内のindexをキーにする。 */
  revealed: Record<number, number>
  reveal: (index: number, count: number) => void
  toggleAll: () => void
  step: number
}

/**
 * diff提案の折りたたみ行の展開状態。行ごとに少しずつ開く操作と、全部開く操作の両方を持つ。
 *
 * @param rowList diff提案の行。
 * @returns 折りたたみ状態と操作。
 */
export function useDiffFold(rowList: DiffRow[]): DiffFoldState {
  const [expanded, setExpanded] = useState(false)
  const [revealed, setRevealed] = useState<Record<number, number>>({})

  const reveal = useCallback(
    (index: number, count: number) => {
      const row = rowList[index]
      if (!row || row.kind !== 'fold') return
      const total = (row as DiffFoldRow).hidden.length
      setRevealed(current => ({
        ...current,
        [index]: Math.min((current[index] ?? 0) + count, total),
      }))
      setExpanded(true)
    },
    [rowList]
  )

  const toggleAll = useCallback(() => {
    if (expanded) {
      setRevealed({})
      setExpanded(false)
      return
    }
    const all: Record<number, number> = {}
    rowList.forEach((row, index) => {
      if (row.kind === 'fold') all[index] = row.hidden.length
    })
    setRevealed(all)
    setExpanded(true)
  }, [expanded, rowList])

  return { expanded, revealed, reveal, toggleAll, step: FOLD_STEP }
}
