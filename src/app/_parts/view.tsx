'use client'

import { Footer } from './components/Footer'
import { HeroSection } from './components/HeroSection'
import { IntroSection } from './components/IntroSection'
import { ScopeNav } from './components/ScopeNav'
import { ScopePanel } from './components/ScopePanel'
import type { ReportModel } from './model/types'
import styles from './page.module.scss'
import { useReport } from './useReport'

/** 表示モデルはServer Componentが組み立てて渡す。 */
export interface ReportViewProps {
  model: ReportModel
  isSignedIn: boolean
}

/**
 * ページ全体のClient Component。状態は`useReport`が持ち、ここは部品の配置だけ。
 *
 * @param props
 * @param props.model ページ全体の表示モデル。
 * @param props.isSignedIn ログインしているか。未ログインで許可リストが空のシリーズを見ているときはフッターを出さない。
 * @returns 描画結果。
 */
export function ReportView({ model, isSignedIn }: ReportViewProps) {
  const report = useReport(model.scopeList)

  return (
    <main>
      <div ref={report.viewportSectionRefList[0]} className={styles.viewportSection} id="top">
        <HeroSection site={model.site} hero={model.hero} />
      </div>
      <div
        ref={report.viewportSectionRefList[1]}
        className={styles.viewportSection}
        id="analysis-intro"
      >
        <IntroSection intro={model.intro} viewpointList={model.viewpointList} />
      </div>
      <div className={styles.report} id="report-view">
        <ScopeNav
          title={model.site.title}
          scopeList={model.scopeList}
          selected={report.scope}
          stuck={report.stuck}
          navRef={report.navRef}
          tabRefList={report.scopeTabRefList}
          onSelect={key => report.selectScope(key, true)}
          onKeyDown={report.onScopeKeyDown}
        />
        {model.scopeList.map(scope => (
          <ScopePanel
            key={scope.key}
            scope={scope}
            selected={scope.key === report.scope}
            analysisTitle={model.analysisTitle}
            viewpointList={model.viewpointList}
            modelLabel={model.media.model}
            viewpoint={report.viewpointOf(scope.key)}
            filter={report.filter}
            viewpointTabRefList={report.viewpointTabRefList}
            onFound={() => report.selectScope(scope.key)}
            onViewpointSelect={viewpoint => report.selectViewpoint(scope.key, viewpoint)}
            onViewpointKeyDown={(event, viewpoint) =>
              report.onViewpointKeyDown(event, scope.key, viewpoint)
            }
            onFilterChange={report.setFilter}
            onScopeSelect={report.activateScopeTab}
          />
        ))}
      </div>
      {isSignedIn && <Footer />}
    </main>
  )
}
