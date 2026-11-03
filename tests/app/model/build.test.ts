/**
 * `buildReportModel`は、シリーズの`report`が全体スコープまたは`scopeList`のいずれかで欠けていれば
 * 止まる（routing.mdのエラーハンドリング）。ここはその失敗経路を、フル計算に要る比較データ等を
 * 用意せずに確認する（欠落判定は`computeOverviewCriteria`等より前に行われるため）。
 * あわせて、ヒーローの導入文（`descriptionHtml`）を確認する。
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_DESCRIPTION, type ReportContent, type SeriesContent } from '@/lib/api/microcms'
import { buildReportModel, descriptionHtml } from '@/app/_parts/model/build'

const DATE_LIST = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-01-01T00:00:00.000Z',
  revisedAt: '2026-01-01T00:00:00.000Z',
}

const SERIES: SeriesContent = {
  id: 's1',
  ...DATE_LIST,
  seriesKey: 'test-series',
  siteTitle: 'タイトル',
  siteLead: 'リード',
  modelLabel: 'note',
  editedLabel: '書籍',
  scopeList: [{ fieldId: 'scope', scopeId: 0, label: 'はじめに' }],
}

describe('buildReportModel', () => {
  test('throws naming the missing scope when the total scope content is absent', () => {
    expect(() => buildReportModel(SERIES, [])).toThrow("report: missing content for scope 'total'")
  })

  test('throws naming the missing scope when an individual scope content is absent', () => {
    const totalOnly = [{ id: 'r-total', scope: 'total' } as unknown as ReportContent]
    expect(() => buildReportModel(SERIES, totalOnly)).toThrow(
      "report: missing content for scope '0'"
    )
  })
})

describe('descriptionHtml', () => {
  test('uses the default when the series has no description', () => {
    expect(descriptionHtml(undefined)).toBe(DEFAULT_DESCRIPTION)
    expect(descriptionHtml('')).toBe(DEFAULT_DESCRIPTION)
  })

  test('uses the sanitized description when the series has one', () => {
    expect(descriptionHtml('<p>導入文<script>alert(1)</script></p>')).toBe('<p>導入文</p>')
  })
})
