import { describe, expect, test } from 'bun:test'
import { scopeLabel, tryLoadReportConfig } from '@/lib/config/report-config'
import {
  chapterProfilePath,
  editedProfilePath,
  loadChapterProfile,
  loadEditedProfile,
  loadModelProfile,
  modelProfilePath,
} from '@/lib/data/profiles'
import { loadComparisonChapter, loadComparisonTotal } from '@/lib/data/report-data'
import { buildComparisonChapterFile, buildComparisonTotalFile } from '@/lib/policy/comparison'

const { hasSeriesConfig, config } = tryLoadReportConfig()
const scopeIdList = hasSeriesConfig ? config.scopeList.map(scope => scope.id) : []

// The stored comparison_data*.json files carry `sourceList[].path` values from an earlier layout;
// this port computes paths against the configured profile locations. Per the task brief, `path`
// is dropped before comparing — everything else (including sha256, which is computed from file
// bytes that ARE unchanged) must match value-for-value.
function dropSourcePaths(file: { sourceList: { path: string }[] }): unknown {
  return {
    ...file,
    sourceList: file.sourceList.map(({ path: _path, ...rest }) => rest),
  }
}

describe.skipIf(!hasSeriesConfig)(
  'comparison.ts reproduces the stored comparison_data*.json',
  () => {
    test('comparison_data.json (total scope)', () => {
      const model = loadModelProfile(config).stylometricProfile
      const edited = loadEditedProfile(config).stylometricProfile
      const computed = buildComparisonTotalFile({
        root: config.root,
        modelPath: modelProfilePath(config),
        editedPath: editedProfilePath(config),
        model,
        edited,
      })
      const existing = loadComparisonTotal(config)
      expect(dropSourcePaths(computed)).toEqual(dropSourcePaths(existing))
    })

    test.each(scopeIdList)('comparison_data%d.json (chapter scope)', scope => {
      const model = loadModelProfile(config).stylometricProfile
      const chapter = loadChapterProfile(config, scope).stylometricProfile
      const computed = buildComparisonChapterFile({
        root: config.root,
        scope,
        label: scopeLabel(scope),
        modelPath: modelProfilePath(config),
        chapterPath: chapterProfilePath(config, scope),
        model,
        chapter,
      })
      const existing = loadComparisonChapter(config, scope)
      expect(dropSourcePaths(computed)).toEqual(dropSourcePaths(existing))
    })
  }
)
