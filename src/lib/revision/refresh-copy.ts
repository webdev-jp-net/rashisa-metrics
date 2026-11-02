import { join } from 'node:path'
import { readJson } from '../data/json-io'
import { candidatesPath } from '../data/propose'
import { diffDataPath } from '../data/report-data'
import { currentPlan } from './evaluate'
import { deepEqual, ensure, saveJson } from './io'
import type { RevisionContext } from './measure'
import { COPY_FIELD_LIST, validateCopy } from './reader-copy'
import {
  REVISION_VERSION,
  type CandidatesFile,
  type PublishedDiffData,
  type PublishedEdit,
} from './types'

/** 公開済みの編集とその候補が同一の変更だと判定するために、両者で一致している必要があるフィールド。 */
const IDENTITY_FIELD_LIST = ['start', 'end', 'before', 'after', 'targetList'] as const

/** `changed`は説明文が差し替わった編集だけ。検査（`validateCopy`）はこの分にだけかける。 */
export interface RefreshResult {
  data: PublishedDiffData
  changed: PublishedEdit[]
}

/**
 * 公開済みの各編集の説明文を、同じidの候補の説明文で差し替える。公開済みの変更案（`editList[]`）と候補
 * （`candidatesN.json`）で本文・範囲・対象が一致しなければ別の変更なので拒否する。
 *
 * @param data 公開済みデータ。この場で書き換える。
 * @param review 候補ファイルの内容。
 * @returns 書き換え後のデータと、変わった編集。
 * @throws 候補idが重複する、または候補と一致しない編集があれば止める。
 */
export function applyRefreshedCopy(data: PublishedDiffData, review: CandidatesFile): RefreshResult {
  const candidateList = review.candidateList ?? []
  const byId = new Map(candidateList.map(candidate => [candidate.id, candidate]))
  ensure(byId.size === candidateList.length, 'Duplicate candidate IDs')

  const changed: PublishedEdit[] = []
  for (const edit of data.editList) {
    const candidate = byId.get(edit.id as string)
    ensure(
      candidate !== undefined &&
        IDENTITY_FIELD_LIST.every(field => deepEqual(candidate[field], edit[field])),
      `変更案の本文・対象または採用候補が変わっています。説明文だけの更新はできません: ${String(edit.id)}`
    )
    if (COPY_FIELD_LIST.some(field => !deepEqual(candidate[field], edit[field]))) {
      for (const field of COPY_FIELD_LIST) edit[field] = candidate[field]
      changed.push(edit)
    }
  }
  return { data, changed }
}

/**
 * refresh-copy段階の入口。公開済みデータの`displayReason`・`tradeoff`だけを書き換える。
 * 計測値・採用結果・承認記録はそのまま保ち、再計測は行わない。
 *
 * @param ctx 設定と解析器。
 * @param scope スコープid（`config.scopeList[].id`のいずれか）。
 * @param write falseなら保存しない。
 * @returns 書き換え後のデータと、変わった編集。
 * @throws 未公開のスコープ、または公開後に入力が変わっていれば止める。
 */
export function refreshCopy(ctx: RevisionContext, scope: number, write = true): RefreshResult {
  const { config } = ctx
  const { plan } = currentPlan(ctx, scope)
  const destination = diffDataPath(config, scope)
  const data = readJson<PublishedDiffData>(destination)
  ensure(
    data.version === REVISION_VERSION && data.section === scope,
    'Publish this chapter before refreshing explanations'
  )
  ensure(deepEqual(data.sourceHashList, plan.sourceHashList), 'Published inputs changed')

  const review = readJson<CandidatesFile>(candidatesPath(config, scope))
  const result = applyRefreshedCopy(data, review)
  validateCopy(result.changed, candidatesPath(config, scope))

  if (write) {
    saveJson(destination, result.data)
    if (scope === 0) saveJson(join(config.pathList.report, 'preface_diff_data.json'), result.data)
  }
  return result
}
