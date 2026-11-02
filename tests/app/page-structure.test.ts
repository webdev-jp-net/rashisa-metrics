import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { tryLoadReportConfig } from '@/lib/config/report-config'
import { loadComparisonTotal, loadDiffData } from '@/lib/data/report-data'
import { buildReportModel } from '@/app/_parts/model'
import type { ReportModel } from '@/app/_parts/model/types'
import { ReportView } from '@/app/_parts/view'
import { localCmsContents } from './cms-fixture'

/**
 * Renders the page the way a request does: the real data files are turned into the exact shapes
 * microCMS returns, and the page model is built from those alone. SCSS module imports resolve to
 * an empty object under bun, so class names are absent from this markup; every assertion keys off
 * ids, roles and ARIA attributes instead. No manuscript text is asserted on or printed.
 */
const { hasSeriesConfig, config } = tryLoadReportConfig()
const contents = hasSeriesConfig ? await localCmsContents(config) : null
const model = contents
  ? buildReportModel(contents.series, contents.reportList)
  : (undefined as unknown as ReportModel)
const markup = hasSeriesConfig
  ? renderToStaticMarkup(createElement(ReportView, { model, isSignedIn: true }))
  : ''

const count = (pattern: RegExp) => markup.match(pattern)?.length ?? 0
const scopeCount = hasSeriesConfig ? config.scopeList.length : 0

describe.skipIf(!hasSeriesConfig)('report model', () => {
  test('covers the configured scopes and 4 viewpoints of each', () => {
    expect(model.scopeList).toHaveLength(scopeCount + 1)
    expect(model.scopeList.map(scope => scope.key)).toEqual([
      'total',
      ...config.scopeList.map(scope => String(scope.id)),
    ])
    for (const scope of model.scopeList) {
      expect(scope.analysis.lsm.finding.heading.length).toBeGreaterThan(0)
      expect(scope.analysis.endings.finding.paragraphList.length).toBeGreaterThan(0)
      expect(scope.analysis.politeness.finding.paragraphList.length).toBeGreaterThan(0)
      expect(scope.analysis.length.chartList).toHaveLength(2)
    }
  })

  test('builds the lead sentence from the media labels of the series', () => {
    const total = model.scopeList[0].proposal
    expect(total?.kind).toBe('total')
    if (total?.kind !== 'total') return
    const { modelLabel, editedLabel } = contents!.series
    expect(total.leadText).toBe(
      `${modelLabel}で公開中の記事をお手本とし、${editedLabel}が${modelLabel}らしい文体かどうか分析しました。`
    )
    expect(total.table.regionLabel).toBe(`全体と各章の${modelLabel}比較表`)
  })

  test('comparison table has 28 metric columns and one row per scope', () => {
    const total = model.scopeList[0].proposal
    if (total?.kind !== 'total') throw new Error('expected the total proposal')
    expect(total.table.columnList).toHaveLength(28)
    expect(total.table.rowList).toHaveLength(scopeCount + 1)
    expect(total.table.rowList.every(row => row.cellList.length === 28)).toBe(true)
    expect(total.table.denominator).toBe(27)
    expect(total.table.filterList.map(filter => filter.view)).toEqual([
      'main',
      'LSM',
      '文末',
      '丁寧度',
      'length',
      'all',
    ])
  })

  test('total scope LSM figure carries the saved comparison values', () => {
    const comparison = loadComparisonTotal(config)
    const { figure } = model.scopeList[0].analysis.lsm
    expect(figure.average).toBe(comparison.lsm.mean)
    expect(figure.rowList.map(row => row.lsm)).toEqual(
      comparison.lsm.categoryList.map(row => row.lsm)
    )
    expect(figure.modelLabel).toBe(contents!.series.modelLabel)
    expect(figure.editedLabel).toBe(contents!.series.editedLabel)
  })

  test('every scope proposal carries a diff box and mean LSM before/after', () => {
    const scopeList = model.scopeList.slice(1)
    expect(scopeList).toHaveLength(scopeCount)
    for (const scope of scopeList) {
      const proposal = scope.proposal
      expect(proposal?.kind).toBe('scope')
      if (proposal?.kind !== 'scope') continue
      expect(proposal.lsm.before).toMatch(/^\d\.\d{3}$/)
      expect(proposal.lsm.after).toMatch(/^\d\.\d{3}$/)
      expect(proposal.diff.rowList.length).toBeGreaterThan(0)
      expect(proposal.metricList.length).toBeGreaterThan(0)
    }
  })
})

describe.skipIf(!hasSeriesConfig)('diff rows', () => {
  /**
   * The ported SequenceMatcher was checked against the legacy index.html: for every scope, the
   * rendered rows were byte-identical to the legacy diff body. These assertions hold the
   * properties that check survives — the diff files are regenerated, so exact counts are not
   * pinned here.
   */
  const scopeList = () =>
    model.scopeList.slice(1).map(scope => {
      if (scope.proposal?.kind !== 'scope') throw new Error(`${scope.key} has no proposal`)
      return { key: scope.key, diff: scope.proposal.diff }
    })

  test('renders every old and new line exactly once, in order', () => {
    for (const { key, diff } of scopeList()) {
      const oldNumberList: number[] = []
      const newNumberList: number[] = []
      for (const row of diff.rowList) {
        if (row.kind === 'context') {
          oldNumberList.push(row.oldNumber)
          newNumberList.push(row.newNumber)
        } else if (row.kind === 'changed') {
          if (row.oldNumber !== null) oldNumberList.push(row.oldNumber)
          if (row.newNumber !== null) newNumberList.push(row.newNumber)
        } else if (row.kind === 'fold') {
          for (const hidden of row.hidden) {
            oldNumberList.push(hidden.oldNumber)
            newNumberList.push(hidden.newNumber)
          }
        }
      }
      expect({ key, old: oldNumberList.every((value, index) => value === index + 1) }).toEqual({
        key,
        old: true,
      })
      expect({ key, next: newNumberList.every((value, index) => value === index + 1) }).toEqual({
        key,
        next: true,
      })
      expect(oldNumberList.length).toBeGreaterThan(0)
    }
  })

  test('carries one reason row per stored edit', () => {
    for (const { key, diff } of scopeList()) {
      const reasonList = diff.rowList.filter(row => row.kind === 'reason')
      const editList = loadDiffData(config, diff.scope).editList
      expect({ key, reasons: reasonList.length }).toEqual({ key, reasons: editList.length })
      // microCMSは変更案のidを持たないので、理由行のDOM idは送信時の並びの連番になる
      expect(reasonList.map(row => (row.kind === 'reason' ? row.id : ''))).toEqual(
        editList.map((_, index) => `reason-${diff.scope}-${index}`)
      )
    }
  })

  test('folds only runs longer than the context window, with a hunk header', () => {
    for (const { diff } of scopeList()) {
      for (const row of diff.rowList) {
        if (row.kind !== 'fold') continue
        expect(row.hidden.length).toBeGreaterThan(0)
        expect(row.header).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/)
      }
    }
  })
})

describe.skipIf(!hasSeriesConfig)('rendered markup', () => {
  test('renders one scope panel per scope (plus total) and 4 viewpoint panels each', () => {
    expect(count(/id="report-(?:total|\d+)"/g)).toBe(scopeCount + 1)
    expect(count(/id="report-(?:total|\d+)-(?:lsm|endings|politeness|length)"/g)).toBe(
      (scopeCount + 1) * 4
    )
    expect(count(/role="tabpanel"/g)).toBe((scopeCount + 1) * 5)
    expect(count(/role="tablist"/g)).toBe(scopeCount + 2)
  })

  test('renders one diff box per scope', () => {
    expect(count(/id="unfold-all-\d+"/g)).toBe(scopeCount)
    expect(count(/id="diff-body-\d+"/g)).toBe(scopeCount)
  })

  test('renders the comparison table header with 28 metric columns', () => {
    expect(count(/<th scope="col"[^>]*><span>/g)).toBe(28)
  })

  test('shows the total scope LSM mean and the media labels of the series', () => {
    const total = model.scopeList[0].proposal
    if (total?.kind !== 'total') throw new Error('expected the total proposal')
    expect(markup).toContain(total.leadText)
    expect(markup).toContain(`>${model.scopeList[0].analysis.lsm.figure.average.toFixed(3)}</text>`)
    expect(markup).toContain(`${contents!.series.modelLabel}の比率`)
    expect(markup).toContain(`${contents!.series.editedLabel}の比率`)
  })

  test('keeps unselected panels in the document', () => {
    expect(count(/<section[^>]*hidden=""/g)).toBe(43)
  })
})
