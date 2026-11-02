import type { OverviewCriteria, OverviewCriteriaColumn } from '../data/report-data'
import { ensure } from './io'
import type { MetricSpec } from './types'

/** 変更案生成ワークフローが決してtargetにしない2つの一覧列: LSM平均と敬語の合計。 */
const EXCLUDED: readonly [string, string][] = [
  ['LSM', '平均'],
  ['丁寧度', '合計'],
]

/** 一覧の列（group, item）→ プロファイルのフィールドパス。並び順はドキュメントとしての意味しか持たない（`metricSpecList`は列をファイル順に走査する）。 */
const PATH_LIST = new Map<string, string>([
  ['文法語 格助詞', 'lsmCategory.ratioList.caseParticles'],
  ['文法語 係助詞', 'lsmCategory.ratioList.bindingParticles'],
  ['文法語 接続助詞', 'lsmCategory.ratioList.conjunctiveParticles'],
  ['文法語 終助詞', 'lsmCategory.ratioList.finalParticles'],
  ['文法語 助動詞', 'lsmCategory.ratioList.auxiliaries'],
  ['文法語 接続詞', 'lsmCategory.ratioList.conjunctions'],
  ['文法語 代名詞', 'lsmCategory.ratioList.pronouns'],
  ['文法語 副詞', 'lsmCategory.ratioList.adverbs'],
  ['文法語 否定', 'lsmCategory.ratioList.negations'],
  ['文法語 数量詞', 'lsmCategory.ratioList.quantifiers'],
  ['文末 です・ます', 'sentenceEnding.ratioList.desuMasu'],
  ['文末 体言止め等', 'sentenceEnding.ratioList.taigenDomeOrOther'],
  ['文末 文末なし', 'sentenceEnding.ratioList.noEnding'],
  ['文末 終助詞止め', 'sentenceEnding.ratioList.finalParticle'],
  ['文末 記号止め', 'sentenceEnding.ratioList.symbolEnd'],
  ['文末 だ・である', 'sentenceEnding.ratioList.daDearu'],
  ['文末 絵文字止め', 'sentenceEnding.ratioList.emojiEnd'],
  ['丁寧度 丁寧語', 'politeness.teineigoPer1000Morph'],
  ['丁寧度 尊敬語', 'politeness.sonkeigoPer1000Morph'],
  ['丁寧度 謙譲語', 'politeness.kenjougoPer1000Morph'],
  ['文長 平均', 'sentence.lengthDist.mean'],
  ['文長 中央値', 'sentence.lengthDist.median'],
  ['文長 90%点', 'sentence.lengthDist.p90'],
  ['段落長 平均', 'paragraph.lengthDist.mean'],
  ['段落長 中央値', 'paragraph.lengthDist.median'],
  ['段落長 90%点', 'paragraph.lengthDist.p90'],
])

/** 値が比率になっている群。生の小数ではなく百分率（scale 100）として報告する。 */
const RATIO_GROUP_LIST = new Set(['文法語', '文末'])

/**
 * 一覧列の識別子`"群 項目"`。群・項目→指標pathの対応表（`PATH_LIST`）のキーと同じ形。
 *
 * @param column 一覧の列。
 * @returns `"群 項目"`。
 */
function columnKey(column: Pick<OverviewCriteriaColumn, 'group' | 'item'>): string {
  return `${column.group} ${column.item}`
}

/**
 * ドット区切りのpathで計測結果の値を引く。
 *
 * @param data 計測結果。
 * @param path ドット区切りのpath。
 * @returns 値。
 * @throws 途中の階層が無ければpathを名指しして止める（指標pathの誤りを黙って0にしない）。
 */
export function getPath(data: unknown, path: string): unknown {
  let current = data
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || !(part in (current as object))) {
      throw new Error(path)
    }
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * 指標の値を一覧と同じ単位（比率は百分率）で取り出す。
 *
 * @param profile 計測結果。
 * @param spec 指標のpathとscale。
 * @returns 一覧と同じ単位の値。
 */
export function getValue(profile: unknown, spec: Pick<MetricSpec, 'path' | 'scale'>): number {
  return Number(getPath(profile, spec.path)) * spec.scale
}

/**
 * 一覧の根拠データから、1スコープ分の26指標の仕様（お手本の値・改稿前の値・強調閾値・基準超過か）を作る。
 * 改稿前の値`before`は保存済みの差分（お手本との差）から復元する。`valueList`は行0が全体スコープで、以降が
 * スコープid昇順なので、該当行はスコープidを昇順に並べた位置＋1。
 *
 * @param overview 一覧の根拠データ。
 * @param scope スコープid（`scopeIdList`のいずれか）。
 * @param scopeIdList 全スコープのid（昇順）。`overview.labelList`の2件目以降と同じ並び。
 * @returns 26指標の仕様。
 * @throws `scopeIdList`の件数が一覧の行数と合わない、スコープidが`scopeIdList`に無い、列が未知・重複、
 *   または26列に揃わなければ止める。
 */
export function metricSpecList(
  overview: OverviewCriteria,
  scope: number,
  scopeIdList: number[]
): MetricSpec[] {
  ensure(
    scopeIdList.length === overview.labelList.length - 1,
    `overview has ${overview.labelList.length - 1} scope rows, but ${scopeIdList.length} scope ids were given`
  )
  const position = scopeIdList.indexOf(scope)
  ensure(position !== -1, `scope must be one of ${scopeIdList.join(',')}`)
  const columnList = overview.columnList
  ensure(Array.isArray(columnList), 'overview.columnList is required')

  const excluded = new Set(EXCLUDED.map(([group, item]) => `${group} ${item}`))
  const specList: MetricSpec[] = []
  const seen = new Set<string>()
  const row = position + 1

  for (const column of columnList) {
    const key = columnKey(column)
    if (excluded.has(key)) continue
    const path = PATH_LIST.get(key)
    ensure(path !== undefined, `Unknown overview column: ${column.group}/${column.item}`)
    ensure(!seen.has(key), `Duplicate overview column: ${column.group}/${column.item}`)
    seen.add(key)

    const isRatio = RATIO_GROUP_LIST.has(column.group)
    const model = Number(column.model)
    specList.push({
      id: path,
      path,
      label: `${column.group}・${column.item}`,
      group: column.group,
      unit: isRatio ? '%' : column.unit,
      scale: isRatio ? 100 : 1,
      model,
      before: model + Number(column.valueList[row]),
      limit: column.limit === null || column.limit === undefined ? null : Number(column.limit),
      standout: (column.flaggedRowList ?? []).includes(row),
    })
  }

  ensure(specList.length === 26, `Expected 26 overview metrics, got ${specList.length}`)
  return specList
}
