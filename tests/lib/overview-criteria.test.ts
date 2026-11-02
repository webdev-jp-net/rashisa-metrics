import { describe, expect, test } from 'bun:test'
import {
  MODEL_LABEL_PLACEHOLDER,
  scopeLabelList,
  tryLoadReportConfig,
} from '@/lib/config/report-config'
import {
  comparisonChapterPath,
  comparisonTotalPath,
  loadComparisonChapterList,
  loadComparisonTotal,
  loadOverviewCriteria,
} from '@/lib/data/report-data'
import { computeOverviewCriteria } from '@/lib/policy/overview-criteria'

const { hasSeriesConfig, config } = tryLoadReportConfig()

describe.skipIf(!hasSeriesConfig)(
  'overview-criteria.ts reproduces the stored overview_criteria.json',
  () => {
    test('value-for-value from the existing comparison_data*.json files', () => {
      const total = loadComparisonTotal(config)
      const chapterList = loadComparisonChapterList(config)
      const overviewLabelList = ['全体', ...scopeLabelList(config)]
      const scopeIdList = config.scopeList.map(scope => scope.id).sort((a, b) => a - b)

      const sourceFileList = [
        { comparisonFile: 'comparison_data.json', path: comparisonTotalPath(config) },
        ...scopeIdList.map(scope => ({
          comparisonFile: `comparison_data${scope}.json`,
          path: comparisonChapterPath(config, scope),
        })),
      ]

      const computed = computeOverviewCriteria({
        datasetList: [total, ...chapterList],
        overviewLabelList,
        sourceFileList,
        modelLabel: MODEL_LABEL_PLACEHOLDER,
      })

      const existing = loadOverviewCriteria(config)
      expect(computed).toEqual(existing)
    })
  }
)
