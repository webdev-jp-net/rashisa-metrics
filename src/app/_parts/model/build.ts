import {
  DEFAULT_DESCRIPTION,
  TOTAL_SCOPE,
  type ReportContent,
  type SeriesContent,
} from '@/lib/api/microcms'
import type { ComparisonScopeData, OverviewCriteria } from '@/lib/data/report-data'
import { CHAPTER_AXIS_LIST } from '@/lib/policy/comparison'
import { computeOverviewCriteria } from '@/lib/policy/overview-criteria'
import { sanitizeHtml } from '@/lib/sanitize'
import { formatFixed, formatSigned, formatThousands } from '../format'
import { contentComparisonData, contentFindingList, contentReportMaterial } from './report-content'
import { scopeProposal } from './scope-proposal'
import type {
  AnalysisModel,
  ComparisonCell,
  ComparisonColumn,
  ComparisonRow,
  ComparisonTableModel,
  FindingModel,
  ReportModel,
  ScopeModel,
  TotalProposalModel,
  ViewpointDefinition,
  ViewpointKey,
} from './types'

/** 全体スコープの棒グラフ上限値。個別スコープ分はCHAPTER_AXESから取得する。 */
const TOTAL_AXIS_LIST = { endings: 60, politeness: 40, sentence: 80, paragraph: 160 }

/** 4観点のカード定義（見出し・説明）。画面の並び順。 */
const VIEWPOINT_CARD_LIST: Omit<ViewpointDefinition, 'tabLabel'>[] = [
  {
    key: 'lsm',
    name: 'LSM',
    subtitle: 'Language Style Matching',
    text: '言葉の使い方の類似度を、1にどれだけ近いかで表す指標です。',
    example: '一例では、同じ人物の発言どうしのゆれはLSM0.95の類似度でした。',
  },
  {
    key: 'endings',
    name: '文末表現',
    text: 'です・ます、体言止め、だ・である など、文を締めくくる言葉の使用比率です。',
  },
  {
    key: 'politeness',
    name: '敬語の密度',
    text: '同じ文章量あたりの尊敬語・謙譲語・丁寧語の使用量を比較した値です。',
  },
  {
    key: 'length',
    name: '文・段落の長さ',
    text: '一文・ひと段落あたりの文字数です。値が大きいほど、区切らず続けて書く傾向を示します。',
    example: '現代の文章の一文の長さは平均30〜40字程度とされています。',
  },
]

/** 観点タブの短い表示名。 */
const VIEWPOINT_TAB_LABEL_LIST: Record<ViewpointKey, string> = {
  lsm: 'LSM 類似度',
  endings: '文末表現',
  politeness: '敬語の密度',
  length: '文・段落の長さ',
}

/** カード定義とタブ名を合わせた観点一覧。 */
const VIEWPOINT_LIST: ViewpointDefinition[] = VIEWPOINT_CARD_LIST.map(card => ({
  ...card,
  tabLabel: VIEWPOINT_TAB_LABEL_LIST[card.key],
}))

/** フィルタボタンは、文法語列をLSM平均とまとめて表示する。 */
const DISPLAY_GROUP: Record<string, string> = { 文法語: 'LSM' }

/** 「主要項目」フィルタに残す列の選定規則。 */
const FEATURED: Record<string, (item: string) => boolean> = {
  LSM: item => item === '平均',
  文法語: () => false,
  文末: item => item === 'です・ます' || item === '終助詞止め',
  丁寧度: item => item === '丁寧語' || item === '謙譲語',
  文長: () => true,
  段落長: () => true,
}

/** 一覧の群名 → 総括で使う観点名。 */
const SUMMARY_GENRE: Record<string, string> = {
  文法語: 'LSM',
  文末: '文末表現',
  丁寧度: '敬語の密度',
  文長: '文・段落の長さ',
  段落長: '文・段落の長さ',
}

/**
 * 分析パネル（4観点の図表と総評）の表示モデル。
 *
 * @param data スコープの比較データ。
 * @param findingList スコープの4観点の総評。
 * @param axisList 棒グラフの上限。
 * @param modelLabel お手本媒体の表示名。
 * @param editedLabel 編集対象媒体の表示名。
 * @returns 表示モデル。
 */
function analysisModel(
  data: ComparisonScopeData,
  findingList: Record<ViewpointKey, FindingModel>,
  axisList: typeof TOTAL_AXIS_LIST,
  modelLabel: string,
  editedLabel: string
): AnalysisModel {
  const seriesList: [string, string] = [modelLabel, editedLabel]
  return {
    lsm: {
      figure: {
        rowList: data.lsm.categoryList.map(row => ({
          label: row.label,
          model: row.model,
          edited: row.edited,
          lsm: row.lsm,
        })),
        average: data.lsm.mean,
        editedLabel,
        modelLabel,
      },
      finding: findingList.lsm,
    },
    endings: {
      chart: {
        title: '文末表現の割合',
        rowList: data.sentenceEnding.rowList.map(row => [...row] as [string, number, number]),
        maximum: axisList.endings,
        unit: '%',
        seriesList,
      },
      finding: findingList.endings,
    },
    politeness: {
      chart: {
        title: '敬語の密度（形態素1,000あたり）',
        rowList: data.politeness.rowList.map(row => [...row] as [string, number, number]),
        maximum: axisList.politeness,
        unit: '‰',
        seriesList,
      },
      finding: findingList.politeness,
    },
    length: {
      chartList: [
        {
          title: '一文の長さ：分布の要約値',
          rowList: data.length.rowList.sentence.map(row => [...row] as [string, number, number]),
          maximum: axisList.sentence,
          unit: '字',
          seriesList,
          chartLabel: '一文の長さ',
        },
        {
          title: '段落の長さ：分布の要約値',
          rowList: data.length.rowList.paragraph.map(row => [...row] as [string, number, number]),
          maximum: axisList.paragraph,
          unit: '字',
          seriesList,
          chartLabel: '段落の長さ',
        },
      ],
      finding: findingList.length,
    },
  }
}

/** 全体スコープの表と総括に共通の入力。 */
interface TotalInputs {
  criteria: OverviewCriteria
  labelList: string[]
  charCountList: number[]
  modelLabel: string
  editedLabel: string
}

/**
 * 一覧表の表示モデル。値・強調（`flaggedRowList`）・件数を一覧の根拠データから写す。
 *
 * @param inputs 一覧の根拠データ・ラベル・文字数・媒体名。
 * @returns 表示モデル。
 */
function comparisonTable(inputs: TotalInputs): ComparisonTableModel {
  const { criteria, labelList, charCountList, modelLabel } = inputs
  const columnList: ComparisonColumn[] = criteria.columnList.map(column => ({
    group: column.group,
    item: column.item,
    displayGroup: DISPLAY_GROUP[column.group] ?? column.group,
    main: FEATURED[column.group](column.item),
  }))

  const rowList: ComparisonRow[] = labelList.map((label, index) => {
    const flaggedItemList = criteria.columnList
      .filter(column => column.flaggedRowList.includes(index))
      .map(column => `${column.group}・${column.item}`)
    const cellList: ComparisonCell[] = criteria.columnList.map((column, columnIndex) => {
      const value = column.valueList[index]
      const isLsmMean = column.group === 'LSM' && column.item === '平均'
      const text = isLsmMean
        ? formatFixed(value, 3)
        : Math.abs(value) >= 0.005
          ? formatSigned(value, 2)
          : '0.00'
      const title = isLsmMean
        ? `Pennebaker(2011)のhigh synchrony目安（${formatFixed(column.limit as number, 2)}以上）未満`
        : column.counted
          ? `${modelLabel} ${formatFixed(column.model as number, 3)}／差の許容幅 ±${formatFixed(column.limit as number, 3)}${column.unit}（暫定）`
          : '参考値・件数に含めません'
      return {
        text,
        standout: column.flaggedRowList.includes(index),
        title,
        displayGroup: columnList[columnIndex].displayGroup,
        main: columnList[columnIndex].main,
      }
    })
    return {
      scopeKey: index === 0 ? 'total' : String(index - 1),
      label,
      count: criteria.countList[index],
      countTitle: flaggedItemList.join('、') || '該当なし',
      chars: formatThousands(charCountList[index]),
      cellList,
    }
  })

  return {
    columnList,
    rowList,
    filterList: [
      { view: 'main', label: '主要項目' },
      { view: 'LSM', label: VIEWPOINT_TAB_LABEL_LIST.lsm, badge: 1 },
      { view: '文末', label: VIEWPOINT_TAB_LABEL_LIST.endings, badge: 2 },
      { view: '丁寧度', label: VIEWPOINT_TAB_LABEL_LIST.politeness, badge: 3 },
      { view: 'length', label: VIEWPOINT_TAB_LABEL_LIST.length, badge: 4 },
      { view: 'all', label: '全項目' },
    ],
    denominator: criteria.countDenominator,
    regionLabel: `全体と各章の${modelLabel}比較表`,
    hintList: [
      'お手本との差が一定の基準を超えている箇所をハイライトしています。',
      '全体は全文の集計値で、章別値の単純平均ではありません。文字数は分析に用いた抽出データの文字数です。表示は丸めています。',
    ],
  }
}

/**
 * 全体スコープの総括の表示モデル。LSMの最高・最低スコープと、全体行で基準超過した項目ごとの調整文を組み立てる。
 *
 * @param inputs 一覧の根拠データ・ラベル・文字数・媒体名。
 * @returns 表示モデル。
 */
function totalProposal(inputs: TotalInputs): TotalProposalModel {
  const { criteria, labelList, modelLabel, editedLabel } = inputs
  const lsmValueList = criteria.columnList[0].valueList
  const overall = lsmValueList[0]
  const overallText =
    overall >= criteria.lsmSynchronyThreshold
      ? `全体を総合的に解析すると、言葉の使い方の類似度を図るLSMが${formatFixed(overall, 3)}で、高い一致度です。`
      : `全体を総合的に解析すると、言葉の使い方の類似度を図るLSMは${formatFixed(overall, 3)}です。`

  let lowest = 1
  let highest = 1
  for (let index = 2; index < labelList.length; index += 1) {
    if (lsmValueList[index] < lsmValueList[lowest]) lowest = index
    if (lsmValueList[index] > lsmValueList[highest]) highest = index
  }

  const suggestionList: string[] = []
  for (const column of criteria.columnList) {
    if (!column.counted || !column.flaggedRowList.includes(0)) continue
    if (column.group === 'LSM') {
      suggestionList.push('LSM - 全体の類似度を上げる調整')
      continue
    }
    const value = column.valueList[0]
    const lengthGroup = column.group === '文長' || column.group === '段落長'
    const action = lengthGroup
      ? value > 0
        ? '短くする'
        : '長くする'
      : value < 0
        ? '増やす'
        : '減らす'
    const item = lengthGroup ? `${column.group}・${column.item}` : column.item
    suggestionList.push(`${SUMMARY_GENRE[column.group]} - ${item}を${action}調整`)
  }

  return {
    kind: 'total',
    leadText: `${modelLabel}で公開中の記事をお手本とし、${editedLabel}が${modelLabel}らしい文体かどうか分析しました。`,
    overallText,
    rangeLineList: [
      '章ごとに区切って分析した場合は、ばらつきがあり',
      `最も一致していなかったのが${labelList[lowest]}の${formatFixed(lsmValueList[lowest], 3)}、最も一致していたのが${labelList[highest]}の${formatFixed(lsmValueList[highest], 3)}でした。`,
    ],
    suggestionListLabel: '指標を基準に文体を近づける提案：',
    suggestionList,
    table: comparisonTable(inputs),
  }
}

/**
 * `scope`で`report`の1件を引く。
 *
 * @param byScope `scope`で引ける`report`。
 * @param scope 全体スコープは`total`、個別スコープはスコープid。
 * @returns 該当コンテンツ。
 * @throws 該当が無ければ、`scope`を名指しして止める。
 */
function requireContent(byScope: Map<string, ReportContent>, scope: string): ReportContent {
  const content = byScope.get(scope)
  if (content === undefined) {
    throw new Error(`report: missing content for scope '${scope}'`)
  }
  return content
}

/**
 * ヒーローの導入文のHTML。シリーズの`description`はサニタイズして使い、空なら初期値を使う。
 * 初期値はコードの定数なのでサニタイズしない。
 *
 * @param description シリーズの`description`。値が無ければmicroCMSは返さない。
 * @returns 画面に埋め込むHTML。
 */
export function descriptionHtml(description: string | undefined): string {
  return description ? sanitizeHtml(description) : DEFAULT_DESCRIPTION
}

/**
 * ページ全体の表示モデル。Server Componentがリクエストごとに呼ぶ入口で、microCMSから取得した
 * 1シリーズの内容だけから全スコープ分を組み立てる。ファイルは一切読まない。
 *
 * @param series パスで指定したシリーズ（`getSeriesByKey`の結果）。
 * @param reportList そのシリーズのスコープごとの表示材料（`getReportList`の結果）。並び順は問わない。
 * @returns 表示モデル。
 * @throws 全体スコープまたはシリーズの`scopeList`にあるスコープのコンテンツが欠けている、総評が
 *   4観点そろっていない、あるいは表に出す指標の観点が未知なら止める。
 */
export function buildReportModel(series: SeriesContent, reportList: ReportContent[]): ReportModel {
  const modelLabel = series.modelLabel
  const editedLabel = series.editedLabel
  const scopeEntryList = [...series.scopeList].sort((a, b) => a.scopeId - b.scopeId)
  const labelList = scopeEntryList.map(scope => scope.label)
  const overviewLabelList = ['全体', ...labelList]

  const byScope = new Map(reportList.map(report => [report.scope, report]))
  const totalContent = requireContent(byScope, TOTAL_SCOPE)
  const scopeContentList = scopeEntryList.map(scope =>
    requireContent(byScope, String(scope.scopeId))
  )

  // 総評の欠けは、表示モデルを組み立てる前にまとめて検出する
  const totalFindingList = contentFindingList(totalContent)
  const scopeFindingList = scopeContentList.map(contentFindingList)

  const total = contentComparisonData(totalContent)
  const chapterList = scopeContentList.map(contentComparisonData)
  const datasetList: ComparisonScopeData[] = [total, ...chapterList]
  const criteria = computeOverviewCriteria({
    datasetList,
    overviewLabelList,
    // 画面は`criteria.sourceList`を読まないので、記録用の入力ファイル一覧は渡さない
    sourceFileList: [],
    modelLabel,
  })
  const charCountList = [totalContent, ...scopeContentList].map(content => content.chars)

  const totalInputs: TotalInputs = {
    criteria,
    labelList: overviewLabelList,
    charCountList,
    modelLabel,
    editedLabel,
  }
  const scopeList: ScopeModel[] = [
    {
      key: 'total',
      label: '全体',
      panelId: 'report-total',
      proposal: totalProposal(totalInputs),
      analysis: analysisModel(total, totalFindingList, TOTAL_AXIS_LIST, modelLabel, editedLabel),
    },
    ...scopeEntryList.map((scope, index): ScopeModel => {
      const material = contentReportMaterial(scopeContentList[index], scope.scopeId)
      return {
        key: String(scope.scopeId),
        label: scope.label,
        panelId: `report-${scope.scopeId}`,
        proposal: scopeProposal(material, scope.label, modelLabel),
        analysis: analysisModel(
          chapterList[index],
          scopeFindingList[index],
          { ...CHAPTER_AXIS_LIST },
          modelLabel,
          editedLabel
        ),
      }
    }),
  ]

  return {
    site: { title: series.siteTitle, lead: series.siteLead },
    media: { model: modelLabel, edited: editedLabel },
    viewpointList: VIEWPOINT_LIST,
    scopeList,
    hero: {
      descriptionHtml: descriptionHtml(series.description),
      hintLabel: 'どのように解析？',
    },
    intro: {
      paragraphList: [
        ['文体を解析する4つの観点のデータを抽出し、数値的に近づけた場合の実例を提案しています。'],
        [
          'データ由来の指標には、読み比べによる実感由来の判断とは違った客観性や再現性があります。',
          '編集のヒントとしてお役立てください。',
        ],
      ],
      hintLabel: 'レポートをみる',
    },
    analysisTitle: '分析データ',
  }
}
