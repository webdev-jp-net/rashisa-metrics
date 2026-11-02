#!/usr/bin/env bun
/**
 * @file 文体プロファイルから、画面が描画する比較データ（`comparison_data*.json`）と一覧の根拠データ
 *   （`overview_criteria.json`）を生成する。プロファイルを更新したらこれで作り直す。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  loadReportConfig,
  MODEL_LABEL_PLACEHOLDER,
  scopeLabel,
  scopeLabelList,
} from '../src/lib/config/report-config'
import {
  chapterProfilePath,
  editedProfilePath,
  loadChapterProfile,
  loadEditedProfile,
  loadModelProfile,
  modelProfilePath,
} from '../src/lib/data/profiles'
import { serializeJson } from '../src/lib/data/json-io'
import {
  comparisonChapterPath,
  comparisonTotalPath,
  overviewCriteriaPath,
} from '../src/lib/data/report-data'
import { buildComparisonChapterFile, buildComparisonTotalFile } from '../src/lib/policy/comparison'
import { computeOverviewCriteria } from '../src/lib/policy/overview-criteria'
import { runCli, seriesArg } from './cli'

/** 書き込み先と内容の組。引数`--check`（書き込まず既存ファイルと照合だけする）のときは比較にだけ使う。 */
interface PlannedOutput {
  path: string
  content: string
}

/**
 * 既存の出力ファイルを読む。`--check`で生成結果と照合するため。
 *
 * @param path 比較する既存ファイル。
 * @returns ファイルが無ければnull（初回生成前に`--check`で照合したときは「不一致」として扱うため）。
 */
function readExisting(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

/**
 * 文体プロファイルから比較データ（`comparison_data.json`と`comparison_dataN.json`、Nは`scopeList[].id`）と一覧の根拠データ
 * （`overview_criteria.json`）を生成して書き込む。引数`--check`があれば書き込まず、生成結果が保存済みファイルと
 * 一致するかの検証だけ行う。`overview_criteria.json`は画面が読まないが、`revision.ts prepare`が鮮度確認と
 * target選定に使うので一緒に生成する。表示名はmicroCMSの`series`が正本なので、スコープの表示名とお手本媒体の
 * 表示名はプレースホルダー（`{scopeList.label:N}`・`{modelLabel}`）で書く。
 *
 * @throws 引数`--series`が無い、またはシリーズの設定が読めなければ止める。
 * @example
 * bun run scripts/build-report.ts --series <seriesKey>            # 再生成して書き込む
 * bun run scripts/build-report.ts --check --series <seriesKey>    # 既存ファイルと比較、書き込みしない
 */
function main(): void {
  const argv = process.argv.slice(2)
  const check = argv.includes('--check')
  const config = loadReportConfig(seriesArg(argv))
  const scopeIdList = [...config.scopeList].sort((a, b) => a.id - b.id).map(scope => scope.id)

  const model = loadModelProfile(config).stylometricProfile
  const edited = loadEditedProfile(config).stylometricProfile

  const totalFile = buildComparisonTotalFile({
    root: config.root,
    modelPath: modelProfilePath(config),
    editedPath: editedProfilePath(config),
    model,
    edited,
  })

  const chapterFileList = scopeIdList.map(scope => {
    const chapter = loadChapterProfile(config, scope).stylometricProfile
    return buildComparisonChapterFile({
      root: config.root,
      scope,
      label: scopeLabel(scope),
      modelPath: modelProfilePath(config),
      chapterPath: chapterProfilePath(config, scope),
      model,
      chapter,
    })
  })

  const comparisonOutputList: PlannedOutput[] = [
    { path: comparisonTotalPath(config), content: serializeJson(totalFile) },
    ...chapterFileList.map((file, index) => ({
      path: comparisonChapterPath(config, scopeIdList[index]),
      content: serializeJson(file),
    })),
  ]

  // 初回のシリーズには出力先が無いので、書き込みモードでは最初の書き込みより前に作る（`--check`は書かないので作らない）。
  if (!check) mkdirSync(config.pathList.report, { recursive: true })

  const mismatchList: string[] = []
  for (const output of comparisonOutputList) {
    if (check) {
      const existing = readExisting(output.path)
      if (existing !== output.content) {
        mismatchList.push(output.path)
      }
    } else {
      writeFileSync(output.path, output.content, 'utf-8')
    }
  }

  // sources[].sha256はディスク上の既存ファイルをハッシュ化する。書き込みモードでは直前に
  // 再生成済み、`--check`（照合のみ）では意図的に未書き込みなので、いずれもこれで正しい値になる。
  const overviewLabelList = ['全体', ...scopeLabelList(config)]
  const sourceFileList = [
    { comparisonFile: 'comparison_data.json', path: comparisonTotalPath(config) },
    ...scopeIdList.map(scope => ({
      comparisonFile: `comparison_data${scope}.json`,
      path: comparisonChapterPath(config, scope),
    })),
  ]
  const overviewCriteria = computeOverviewCriteria({
    datasetList: [totalFile, ...chapterFileList],
    overviewLabelList,
    sourceFileList,
    modelLabel: MODEL_LABEL_PLACEHOLDER,
  })
  const overviewOutput: PlannedOutput = {
    path: overviewCriteriaPath(config),
    content: serializeJson(overviewCriteria),
  }

  if (check) {
    const existing = readExisting(overviewOutput.path)
    if (existing !== overviewOutput.content) {
      mismatchList.push(overviewOutput.path)
    }
  } else {
    writeFileSync(overviewOutput.path, overviewOutput.content, 'utf-8')
  }

  if (check) {
    if (mismatchList.length > 0) {
      console.error(`Reproduction mismatch in ${mismatchList.length} file(s):`)
      for (const path of mismatchList) console.error(`  ${path}`)
      process.exit(1)
    }
    console.log(`Verified ${comparisonOutputList.length + 1} files byte-identical.`)
    return
  }

  console.log(`Wrote ${comparisonOutputList.length + 1} files:`)
  for (const output of [...comparisonOutputList, overviewOutput]) console.log(`  ${output.path}`)
}

void runCli(main)
