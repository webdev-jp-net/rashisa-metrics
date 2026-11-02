/**
 * Exercises the microCMS push against a fake client. Like the extract tests, every input is
 * synthetic and written under a throwaway repository, so the real source/ and data/ trees are
 * never read, and no request ever leaves the process.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import type { MicroCMSListResponse } from 'microcms-js-sdk'
import type { ReportCmsClient } from '@/lib/api/microcms'
import { sha256String } from '@/lib/data/json-io'
import { REVISION_VERSION } from '@/lib/revision/types'
import { chapterSource } from '@/lib/text/chapter-source'
import { scopeReportMaterial } from '@/app/_parts/model/scope-proposal'
import {
  buildReportContentList,
  checkContentList,
  importFindings,
  pushContents,
  runPush,
} from '../../scripts/cms-content'
import {
  createFixture,
  removeFixture,
  EDITED_SOURCE_LIST,
  type Fixture,
} from '../lib/extract/fixture'

/** 再測定の26指標（群・項目）。`lsm.mean`を足して27行になる。 */
const METRIC_PATH_LIST: [string, string][] = [
  ['lsmCategory.ratioList.caseParticles', '文法語・格助詞'],
  ['lsmCategory.ratioList.bindingParticles', '文法語・係助詞'],
  ['lsmCategory.ratioList.conjunctiveParticles', '文法語・接続助詞'],
  ['lsmCategory.ratioList.finalParticles', '文法語・終助詞'],
  ['lsmCategory.ratioList.auxiliaries', '文法語・助動詞'],
  ['lsmCategory.ratioList.conjunctions', '文法語・接続詞'],
  ['lsmCategory.ratioList.pronouns', '文法語・代名詞'],
  ['lsmCategory.ratioList.adverbs', '文法語・副詞'],
  ['lsmCategory.ratioList.negations', '文法語・否定'],
  ['lsmCategory.ratioList.quantifiers', '文法語・数量詞'],
  ['sentenceEnding.ratioList.desuMasu', '文末・です・ます'],
  ['sentenceEnding.ratioList.taigen', '文末・体言止め等'],
  ['sentenceEnding.ratioList.none', '文末・文末なし'],
  ['sentenceEnding.ratioList.finalParticle', '文末・終助詞止め'],
  ['sentenceEnding.ratioList.symbol', '文末・記号止め'],
  ['sentenceEnding.ratioList.daDearu', '文末・だ・である'],
  ['sentenceEnding.ratioList.emoji', '文末・絵文字止め'],
  ['politeness.per_1000.teineigo', '丁寧度・丁寧語'],
  ['politeness.per_1000.sonkeigo', '丁寧度・尊敬語'],
  ['politeness.per_1000.kenjougo', '丁寧度・謙譲語'],
  ['sentence.lengthDist.mean', '文長・平均'],
  ['sentence.lengthDist.median', '文長・中央値'],
  ['sentence.lengthDist.p90', '文長・90%点'],
  ['paragraph.lengthDist.mean', '段落長・平均'],
  ['paragraph.lengthDist.median', '段落長・中央値'],
  ['paragraph.lengthDist.p90', '段落長・90%点'],
]

/** 変更案の対象で、かつ値が動く指標。再測定テーブルに出るのはこの1件だけ。 */
const MOVED_PATH = 'sentence.lengthDist.mean'
/** 変更案の対象だが値が動かない指標。表には出ないが、送る材料には残る。 */
const UNMOVED_PATH = 'sentenceEnding.ratioList.desuMasu'

/**
 * 27行の再測定。`target`の2件以外は対象外にし、動くのは1件だけにする。
 *
 * @returns 公開済みデータの`metricList`。
 */
function metricList(): Record<string, unknown>[] {
  const rowList = METRIC_PATH_LIST.map(([path, label]) => ({
    path,
    label,
    unit: path.startsWith('politeness') ? '‰' : path.includes('lengthDist') ? '字' : '%',
    model: 30,
    before: path === MOVED_PATH ? 40 : 50,
    after: path === MOVED_PATH ? 35 : 50,
    target: path === MOVED_PATH || path === UNMOVED_PATH,
    movement: path === MOVED_PATH ? '縮小' : '横ばい',
  }))
  rowList.push({
    path: 'lsm.mean',
    label: '平均LSM',
    unit: '',
    model: 1,
    before: 0.885,
    after: 0.911,
    target: false,
    movement: '',
  })
  return rowList
}

/**
 * 1スコープ分の比較データ。画面と送信が読む値だけを持つ。
 *
 * @param chars 編集対象媒体の文字数。
 * @returns 比較データ。
 */
function comparison(chars: number): Record<string, unknown> {
  return {
    sourceList: [
      { path: 'model', sha256: '', corpusSize: { chars: 100 } },
      { path: 'edited', sha256: '', corpusSize: { chars } },
    ],
    lsm: {
      formula: '',
      categoryList: [
        { category: 'caseParticles', label: '格助詞', model: 0.16, edited: 0.164, lsm: 0.99 },
        { category: 'quantifiers', label: '数量詞', model: 0.02, edited: 0.03, lsm: 0.8 },
      ],
      mean: 0.93,
    },
    sentenceEnding: { unit: '%', rowList: [['です・ます', 53.2, 57.8]] },
    politeness: { unit: '‰', rowList: [['丁寧語', 20, 25]] },
    length: {
      unit: '字',
      rowList: { sentence: [['平均', 30, 40]], paragraph: [['平均', 100, 120]] },
    },
  }
}

/** 一時リポジトリに書いた変更案の、前後の本文。 */
interface WrittenScope {
  original: string
  revised: string
}

/**
 * スコープ0に1件の変更案を持つ公開済みデータを、スコープ1には未完了のデータを書く。
 *
 * @param fixture 一時リポジトリ。
 * @param options `brokenHash`のときは原文のハッシュをわざと食い違わせる。
 * @returns スコープ0の変更前後の本文。
 */
function writeReportData(fixture: Fixture, options: { brokenHash?: boolean } = {}): WrittenScope {
  const report = fixture.config.pathList.report
  mkdirSync(report, { recursive: true })

  const original = chapterSource(EDITED_SOURCE_LIST['scope-00.md']).text
  const start = original.indexOf('書きます')
  const revised = `${original.slice(0, start)}記します${original.slice(start + 4)}`

  const edit = {
    id: 'c001',
    targetList: [MOVED_PATH],
    start,
    end: start + 4,
    before: '書きます',
    after: '記します',
    displayReason: '一文を短く言い切る。',
    tradeoff: '語調がやや硬くなる。',
    modelRefList: ['ex_001'],
    target: MOVED_PATH,
    metricPath: MOVED_PATH,
    label: '文長・平均',
    sourceLine: 6,
    isolated: { model: 30, before: 40, after: 35 },
  }

  writeFileSync(join(report, 'comparison_data.json'), JSON.stringify(comparison(300)), 'utf-8')
  writeFileSync(join(report, 'comparison_data0.json'), JSON.stringify(comparison(120)), 'utf-8')
  writeFileSync(join(report, 'comparison_data1.json'), JSON.stringify(comparison(180)), 'utf-8')
  writeFileSync(
    join(report, 'diff_data0.json'),
    JSON.stringify({
      version: REVISION_VERSION,
      revisionStatus: 'complete',
      section: 0,
      label: 'はじめに',
      sourceFile: 'scope-00.md',
      sourceHashList: {},
      originalTextSha256: options.brokenHash ? sha256String('別の本文') : sha256String(original),
      revisedTextSha256: sha256String(revised),
      editList: [edit],
      metricList: metricList(),
      measurementList: { before: {}, after: {} },
    }),
    'utf-8'
  )
  writeFileSync(
    join(report, 'diff_data1.json'),
    JSON.stringify({
      version: REVISION_VERSION,
      revisionStatus: 'draft',
      section: 1,
      label: '第1章',
      sourceFile: 'scope-01.md',
      sourceHashList: {},
      originalTextSha256: '',
      revisedTextSha256: '',
      editList: [],
      metricList: [],
      measurementList: { before: {}, after: {} },
    }),
    'utf-8'
  )
  return { original, revised }
}

/** 偽クライアントが記録した1回の書き込み。 */
interface RecordedCall {
  endpoint: string
  contentId?: string
  content: Record<string, unknown>
}

/** 偽クライアントが持つ`series`。`seriesKey`で引かれる。 */
const SERIES_KEY = 'test-series'
const SERIES_ID = 'series-1'

/**
 * 送信内容を記録するだけのクライアント。実際の通信は行わない。`series`は`seriesKey`の検索に、
 * `report`はシリーズでの絞り込みに応える（絞り込みの条件自体は検査しない）。
 *
 * @param existingReportList microCMS側に既にある`report`。`scope`で引かれる。
 * @param existingSeries microCMS側にある`series`。無ければシリーズ未作成の状態。
 * @returns クライアントと記録。
 */
function createFakeClient(
  existingReportList: Record<string, unknown>[] = [],
  existingSeries: Record<string, unknown> | null = null
) {
  const created: RecordedCall[] = []
  const updated: RecordedCall[] = []
  const deleted: { endpoint: string; contentId: string }[] = []
  const client: ReportCmsClient = {
    getList: async <T>(request: { endpoint: string }) => {
      const contents =
        request.endpoint === 'series'
          ? existingSeries === null
            ? []
            : [{ id: SERIES_ID, ...existingSeries }]
          : existingReportList
      return {
        contents,
        totalCount: contents.length,
        limit: contents.length,
        offset: 0,
      } as unknown as MicroCMSListResponse<T>
    },
    create: async request => {
      created.push(request)
      return { id: request.endpoint === 'series' ? SERIES_ID : `report-${created.length}` }
    },
    update: async request => {
      updated.push(request)
      return { id: request.contentId ?? '' }
    },
    delete: async request => {
      deleted.push(request)
    },
  }
  return { client, created, updated, deleted }
}

let fixture: Fixture | null = null

/**
 * 一時リポジトリを作る。後始末は`afterEach`が行う。
 *
 * @returns 一時リポジトリ。
 */
function openFixture(): Fixture {
  fixture = createFixture()
  return fixture
}

afterEach(() => {
  if (fixture) removeFixture(fixture)
  fixture = null
})

describe('scopeReportMaterial', () => {
  test('keeps every one of the 27 metrics, unfiltered and unformatted', () => {
    const current = openFixture()
    writeReportData(current)

    const material = scopeReportMaterial(current.config, 0)
    if (material === null) throw new Error('expected a complete revision')

    expect(material.metricList).toHaveLength(27)
    expect(material.metricList.map(metric => metric.item)).toEqual([
      ...METRIC_PATH_LIST.map(([, label]) => label.split('・').slice(1).join('・') || label),
      '平均LSM',
    ])
    // 表に出るのは「対象かつ値が動いた」1件だけ。材料はその絞り込みをしない
    expect(
      material.metricList.filter(metric => metric.target && metric.before !== metric.after)
    ).toHaveLength(1)
    expect(material.metricList.filter(metric => metric.target)).toHaveLength(2)

    // MOVED_PATHはMETRIC_PATHSの21番目（0始まりで20）
    const moved = material.metricList[METRIC_PATH_LIST.findIndex(([path]) => path === MOVED_PATH)]
    expect(moved).toEqual({
      genre: '文・段落の長さ',
      item: '平均',
      unit: '字',
      model: 30,
      before: 40,
      after: 35,
      target: true,
    })
    // 値は数値のまま持つ（画面だけが書式化する）
    expect(material.lsmBefore).toBe(0.885)
    expect(material.lsmAfter).toBe(0.911)
  })

  test('masks the manuscript and rewrites the reason copy for readers', () => {
    const current = openFixture()
    const { original } = writeReportData(current)

    const material = scopeReportMaterial(current.config, 0)
    if (material === null) throw new Error('expected a complete revision')

    expect(material.beforeText).not.toContain('名前太郎')
    expect(material.beforeText).toContain('［著者名］')
    expect(material.afterText).toContain('記します')
    expect(material.reasonList).toEqual([
      {
        id: 'c001',
        line: original.slice(0, original.indexOf('書きます')).split('\n').length - 1,
        title: '文・段落の長さ - 文長・平均を短くする調整',
        reason: '一文を短く言い切る。',
        tradeoff: '語調がやや硬くなる。',
      },
    ])
  })

  test('returns null while the revision is not complete', () => {
    const current = openFixture()
    writeReportData(current)
    expect(scopeReportMaterial(current.config, 1)).toBeNull()
  })
})

describe('push', () => {
  test('creates one content per scope in the existing series, with auto-issued ids', async () => {
    const current = openFixture()
    const { original, revised } = writeReportData(current)
    const { client, created, updated } = createFakeClient([], { seriesKey: SERIES_KEY })

    const contentList = buildReportContentList(current.config)
    const result = await pushContents(client, SERIES_KEY, contentList)

    // 総評は管理画面が書き、表示名はmicroCMSの`series`が正本なので、送る内容に含めない
    const fieldNameList = contentList.flatMap(content => Object.keys(content.fields))
    expect(fieldNameList).not.toContain('findingList')
    expect(fieldNameList).not.toContain('label')

    expect(contentList.map(content => content.scope)).toEqual(['total', '0', '1'])
    expect(result).toEqual({
      reportList: [
        { scope: 'total', action: 'created' },
        { scope: '0', action: 'created' },
        { scope: '1', action: 'created' },
      ],
    })
    // `series`は書かない
    expect(updated).toEqual([])
    // コンテンツIDは指定せず自動発行に任せ、`report`には送り先のシリーズのidを付ける
    expect(created.map(call => call.endpoint)).toEqual(['report', 'report', 'report'])
    expect(created.every(call => call.contentId === undefined)).toBe(true)
    expect(created.map(call => call.content.series)).toEqual([SERIES_ID, SERIES_ID, SERIES_ID])
    expect(created.map(call => call.content.scope)).toEqual(['total', '0', '1'])

    const total = contentList[0].fields
    expect(total.scope).toBe('total')
    expect(total.chars).toBe(300)
    expect(total.lsmMean).toBe(0.93)
    expect(total.lsmCategoryList).toEqual([
      { fieldId: 'lsmCategory', label: '格助詞', model: 0.16, edited: 0.164, lsm: 0.99 },
      { fieldId: 'lsmCategory', label: '数量詞', model: 0.02, edited: 0.03, lsm: 0.8 },
    ])
    expect(total.sentenceEndingList).toEqual([
      { fieldId: 'comparisonRow', label: 'です・ます', model: 53.2, edited: 57.8 },
    ])
    expect(total.paragraphLengthList).toEqual([
      { fieldId: 'comparisonRow', label: '平均', model: 100, edited: 120 },
    ])
    // 全体スコープは変更案を持たない
    expect(total.proposalReady).toBe(false)
    expect(total.beforeText).toBeUndefined()
    expect(total.metricList).toBeUndefined()
    expect(total.lsmBefore).toBeUndefined()

    const scope = contentList[1].fields
    expect(scope.chars).toBe(120)
    expect(scope.proposalReady).toBe(true)
    expect(scope.beforeText).not.toContain('名前太郎')
    expect(scope.beforeText).toBe(
      original.replace('名前太郎', '［著者名］').replace('名前太郎', '［著者名］')
    )
    expect(scope.afterText).toBe(
      revised.replace('名前太郎', '［著者名］').replace('名前太郎', '［著者名］')
    )
    expect(scope.reasonList).toEqual([
      {
        fieldId: 'reason',
        line: original.slice(0, original.indexOf('書きます')).split('\n').length - 1,
        title: '文・段落の長さ - 文長・平均を短くする調整',
        reason: '一文を短く言い切る。',
        tradeoff: '語調がやや硬くなる。',
      },
    ])
    expect(scope.metricList).toHaveLength(27)
    expect(scope.metricList?.[20]).toEqual({
      fieldId: 'metric',
      genre: '文・段落の長さ',
      item: '平均',
      unit: '字',
      before: 40,
      after: 35,
      model: 30,
      target: true,
    })
    expect(scope.lsmBefore).toBe(0.885)
    expect(scope.lsmAfter).toBe(0.911)

    // 未完了のスコープは比較データを送り、変更案のフィールドは空値にする
    const pending = contentList[2].fields
    expect(pending.proposalReady).toBe(false)
    expect(pending.beforeText).toBe('')
  })

  test('clears the proposal fields of a scope that went back to being unfinished', async () => {
    const current = openFixture()
    writeReportData(current)
    // 既に完成版を送ってある状態から、スコープ0だけが未完了に戻る
    const sent = buildReportContentList(current.config)
    const path = join(current.config.pathList.report, 'diff_data0.json')
    const data = JSON.parse(readFileSync(path, 'utf-8')) as { revisionStatus: string }
    data.revisionStatus = 'draft'
    writeFileSync(path, JSON.stringify(data), 'utf-8')

    const { client, updated } = createFakeClient(
      [
        { id: 'r-total', scope: 'total' },
        { id: 'r-0', scope: '0' },
        { id: 'r-1', scope: '1' },
      ],
      { seriesKey: SERIES_KEY }
    )
    const contentList = buildReportContentList(current.config)
    await pushContents(client, SERIES_KEY, contentList)

    expect(sent[1].fields.beforeText).not.toBe('')
    const reverted = contentList[1].fields
    expect(reverted.proposalReady).toBe(false)
    expect({
      beforeText: reverted.beforeText,
      afterText: reverted.afterText,
      reasonList: reverted.reasonList,
      metricList: reverted.metricList,
      lsmBefore: reverted.lsmBefore,
      lsmAfter: reverted.lsmAfter,
    }).toEqual({
      beforeText: '',
      afterText: '',
      reasonList: [],
      metricList: [],
      lsmBefore: 0,
      lsmAfter: 0,
    })
    // 更新はPATCHなので、空値を送らないと前回の本文がmicroCMSに残る
    const request = updated.find(call => call.contentId === 'r-0')
    expect(request?.content.beforeText).toBe('')
    expect(request?.content.metricList).toEqual([])
  })

  test('updates the contents that already exist instead of creating them', async () => {
    const current = openFixture()
    writeReportData(current)
    const { client, created, updated, deleted } = createFakeClient(
      [
        { id: 'r-total', scope: 'total' },
        { id: 'r-0', scope: '0' },
      ],
      { seriesKey: SERIES_KEY }
    )

    const result = await pushContents(client, SERIES_KEY, buildReportContentList(current.config))

    expect(result).toEqual({
      reportList: [
        { scope: 'total', action: 'updated' },
        { scope: '0', action: 'updated' },
        { scope: '1', action: 'created' },
      ],
    })
    // 既存の`report`は`scope`で引き当て、そのコンテンツIDへPATCHする
    expect(updated.map(call => [call.endpoint, call.contentId])).toEqual([
      ['report', 'r-total'],
      ['report', 'r-0'],
    ])
    expect(created.map(call => [call.endpoint, call.content.scope])).toEqual([['report', '1']])
    expect(deleted).toEqual([])
  })

  test('deletes a report whose scope is no longer in the scope index', async () => {
    const current = openFixture()
    writeReportData(current)
    const { client, deleted } = createFakeClient(
      [
        { id: 'r-total', scope: 'total' },
        { id: 'r-0', scope: '0' },
        { id: 'r-1', scope: '1' },
        { id: 'r-9', scope: '9' },
      ],
      { seriesKey: SERIES_KEY }
    )

    const result = await pushContents(client, SERIES_KEY, buildReportContentList(current.config))

    expect(result.reportList).toContainEqual({ scope: '9', action: 'deleted' })
    expect(deleted).toEqual([{ endpoint: 'report', contentId: 'r-9' }])
  })

  test('stops before sending anything when a stored hash does not match', async () => {
    const current = openFixture()
    writeReportData(current, { brokenHash: true })
    const { client, created, updated } = createFakeClient()

    expect(() => buildReportContentList(current.config)).toThrow(
      'originalTextSha256 does not match the manuscript slice'
    )
    expect(() => buildReportContentList(current.config)).toThrow('1件も送信していません')

    // 組み立てと送信の順序は`runPush`が持つので、その入口で書き込みゼロを確かめる
    await expect(runPush(client, current.config)).rejects.toThrow(
      'originalTextSha256 does not match the manuscript slice'
    )
    await expect(runPush(client, current.config, { check: true })).rejects.toThrow(
      '1件も送信していません'
    )
    expect(created).toEqual([])
    expect(updated).toEqual([])
  })

  test('runPush sends everything once the contents are complete', async () => {
    const current = openFixture()
    writeReportData(current)
    const { client, created, updated } = createFakeClient([], { seriesKey: SERIES_KEY })

    const result = await runPush(client, current.config)

    expect(result).toEqual({
      check: false,
      reportList: [
        { scope: 'total', action: 'created' },
        { scope: '0', action: 'created' },
        { scope: '1', action: 'created' },
      ],
    })
    expect(created).toHaveLength(3)
    expect(updated).toEqual([])
  })

  test('stops without writing anything when the series does not exist on microCMS', async () => {
    const current = openFixture()
    writeReportData(current)
    const { client, created, updated, deleted } = createFakeClient()

    await expect(
      pushContents(client, SERIES_KEY, buildReportContentList(current.config))
    ).rejects.toThrow(`series: no content has seriesKey '${SERIES_KEY}'`)
    await expect(runPush(client, current.config)).rejects.toThrow(
      'push and import-findings do not create it'
    )
    expect(created).toEqual([])
    expect(updated).toEqual([])
    expect(deleted).toEqual([])
  })

  test('stops when a stored edit no longer matches the manuscript', () => {
    const current = openFixture()
    writeReportData(current)
    const path = join(current.config.pathList.report, 'diff_data0.json')
    const data = JSON.parse(readFileSync(path, 'utf-8')) as { editList: { before: string }[] }
    data.editList[0].before = '存在しない語'
    writeFileSync(path, JSON.stringify(data), 'utf-8')

    expect(() => buildReportContentList(current.config)).toThrow(
      'edit c001 does not match the text at'
    )
  })
})

describe('check', () => {
  test('reports the differing fields without writing anything', async () => {
    const current = openFixture()
    writeReportData(current)
    const contentList = buildReportContentList(current.config)
    // `label`は送らないフィールドなので、microCMS側の値が何であっても差分に数えない
    const { client, created, updated, deleted } = createFakeClient(
      [
        { id: 'r-total', ...contentList[0].fields, chars: 1, label: '旧ラベル' },
        { id: 'r-9', scope: '9', label: '設定から消えたスコープ' },
      ],
      { seriesKey: SERIES_KEY, allowList: 'example.com' }
    )

    const expected = [
      { target: 'total', missing: false, stale: false, fieldList: ['chars'] },
      { target: '0', missing: true, stale: false, fieldList: Object.keys(contentList[1].fields) },
      { target: '1', missing: true, stale: false, fieldList: Object.keys(contentList[2].fields) },
      { target: '9', missing: false, stale: true, fieldList: [] },
    ]
    expect(await checkContentList(client, SERIES_KEY, contentList)).toEqual(expected)
    expect(await runPush(client, current.config, { check: true })).toEqual({
      check: true,
      reportCount: 3,
      differenceList: expected,
    })
    expect(created).toEqual([])
    expect(updated).toEqual([])
    expect(deleted).toEqual([])
  })

  test('stops when the series does not exist on microCMS', async () => {
    const current = openFixture()
    writeReportData(current)
    const contentList = buildReportContentList(current.config)
    const { client } = createFakeClient()

    await expect(checkContentList(client, SERIES_KEY, contentList)).rejects.toThrow(
      `series: no content has seriesKey '${SERIES_KEY}'`
    )
    await expect(runPush(client, current.config, { check: true })).rejects.toThrow(
      'push and import-findings do not create it'
    )
  })
})

describe('importFindings', () => {
  const axis = {
    heading: '見出し',
    paragraphList: ['1段落目。', '2段落目。'],
    evidence: [{ itemList: ['LSM・平均'], exemplarList: ['ex_001'] }],
  }
  const entry = { lsm: axis, endings: axis, politeness: axis, length: axis }

  test('writes only the findingList field, with the total scope first', async () => {
    const { client, created, updated } = createFakeClient(
      [
        { id: 'r-0', scope: '0' },
        { id: 'r-total', scope: 'total' },
      ],
      { seriesKey: SERIES_KEY }
    )

    const result = await importFindings(client, SERIES_KEY, { '0': entry, all: entry } as never)

    expect(result.reportList).toEqual([
      { scope: 'total', findings: 4 },
      { scope: '0', findings: 4 },
    ])
    expect(created).toEqual([])
    expect(updated.map(call => call.contentId)).toEqual(['r-total', 'r-0'])
    expect(updated.every(call => Object.keys(call.content).join() === 'findingList')).toBe(true)
    const findingList = updated[0].content.findingList as Record<string, unknown>[]
    expect(findingList[0]).toEqual({
      fieldId: 'finding',
      axis: ['lsm'],
      heading: '見出し',
      paragraphList: '1段落目。\n2段落目。',
      evidenceItemList: 'LSM・平均',
      evidenceExemplarList: 'ex_001',
    })
    expect(findingList.map(finding => (finding.axis as string[])[0])).toEqual([
      'lsm',
      'endings',
      'politeness',
      'length',
    ])
  })

  test('refuses a scope key that is neither all nor a number', async () => {
    const { client } = createFakeClient()
    await expect(importFindings(client, SERIES_KEY, { preface: {} } as never)).rejects.toThrow(
      "unknown scope key in the findings file: 'preface'"
    )
  })

  test('stops when the series or the scope is missing on microCMS', async () => {
    const missingSeries = createFakeClient()
    await expect(
      importFindings(missingSeries.client, SERIES_KEY, { all: entry } as never)
    ).rejects.toThrow(`series: no content has seriesKey '${SERIES_KEY}'`)

    const missingScope = createFakeClient([{ id: 'r-total', scope: 'total' }], {
      seriesKey: SERIES_KEY,
    })
    await expect(
      importFindings(missingScope.client, SERIES_KEY, { '0': entry } as never)
    ).rejects.toThrow(`report: series '${SERIES_KEY}' has no scope '0'`)
    expect(missingScope.updated).toEqual([])
  })
})
