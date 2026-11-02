/**
 * Exercises the pure functions in `src/lib/api/microcms.ts` against a fake client that records
 * every request, so the query construction and the missing-content path
 * are checked directly instead of only through the higher-level `push`/screen tests.
 */
import { describe, expect, test } from 'bun:test'
import type { MicroCMSListResponse, MicroCMSQueries } from 'microcms-js-sdk'
import {
  getReportList,
  getSeriesByKey,
  getSeriesList,
  type ReportCmsClient,
} from '@/lib/api/microcms'

/** 1回の`getList`呼び出しの記録。 */
interface RecordedRead {
  endpoint: string
  queries?: MicroCMSQueries
}

/**
 * 呼び出しを記録し、指定した値を返すだけの偽クライアント。書き込みは使わないので未実装のまま置く。
 *
 * @param listResult `getList`が返す`contents`。
 * @returns クライアントと記録。
 */
function createFakeClient(listResult: unknown[]) {
  const readList: RecordedRead[] = []
  const client: ReportCmsClient = {
    getList: async <T>(request: { endpoint: string; queries?: MicroCMSQueries }) => {
      readList.push({ endpoint: request.endpoint, queries: request.queries })
      return {
        contents: listResult,
        totalCount: listResult.length,
        limit: listResult.length,
        offset: 0,
      } as unknown as MicroCMSListResponse<T>
    },
    create: async () => {
      throw new Error('not used by this test')
    },
    update: async () => {
      throw new Error('not used by this test')
    },
    delete: async () => {
      throw new Error('not used by this test')
    },
  }
  return { client, readList }
}

describe('getSeriesByKey', () => {
  test('filters by seriesKey and limits to one', async () => {
    const { client, readList } = createFakeClient([{ id: 's1', seriesKey: 'test-series' }])

    const result = await getSeriesByKey(client, 'test-series')

    expect(readList).toEqual([
      { endpoint: 'series', queries: { limit: 1, filters: 'seriesKey[equals]test-series' } },
    ])
    expect(result).toEqual({ id: 's1', seriesKey: 'test-series' } as never)
  })

  test('returns null when no series matches', async () => {
    const { client } = createFakeClient([])
    expect(await getSeriesByKey(client, 'missing-key')).toBeNull()
  })
})

describe('getSeriesList', () => {
  test('reads every series up to the list limit', async () => {
    const { client, readList } = createFakeClient([{ id: 's1' }, { id: 's2' }])

    const result = await getSeriesList(client)

    expect(readList).toEqual([{ endpoint: 'series', queries: { limit: 100 } }])
    expect(result).toEqual([{ id: 's1' }, { id: 's2' }] as never)
  })
})

describe('getReportList', () => {
  test('filters by the series content id', async () => {
    const { client, readList } = createFakeClient([{ id: 'r1', scope: 'total' }])

    const result = await getReportList(client, 's1')

    expect(readList).toEqual([
      { endpoint: 'report', queries: { limit: 100, filters: 'series[equals]s1' } },
    ])
    expect(result).toEqual([{ id: 'r1', scope: 'total' }] as never)
  })
})
