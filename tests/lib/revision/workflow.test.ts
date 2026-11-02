/**
 * Ports test_revision_workflow.py against the TypeScript workflow. Every fixture here is
 * synthetic: no manuscript text, no measurement. The stages that measure are exercised through
 * their injected `measure` callback, which is how the legacy test patched `measure_details`.
 */
import { join, relative } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { tryLoadReportConfig } from '../../../src/lib/config/report-config'
import { sha256String } from '../../../src/lib/data/json-io'
import {
  applyEdits,
  evaluateCandidates,
  validateReview,
  violations,
} from '../../../src/lib/revision/evaluate'
import { buildPublishData, selectCachedEvaluation } from '../../../src/lib/revision/publish'
import { applyRefreshedCopy } from '../../../src/lib/revision/refresh-copy'
import { REVISION_VERSION } from '../../../src/lib/revision/types'
import type {
  CandidatesFile,
  ChapterMeasurement,
  EvaluationPayload,
  MetricSpec,
  PublishedDiffData,
  RevisionCandidate,
} from '../../../src/lib/revision/types'

const EXEMPLAR_LIST = new Set(['ex_001'])

const { hasSeriesConfig, config } = tryLoadReportConfig()

function candidate(
  id: string,
  start: number,
  end: number,
  before: string,
  after: string,
  target = 'm'
): RevisionCandidate {
  return {
    id,
    start,
    end,
    before,
    after,
    targetList: [target],
    displayReason: '語尾を整える。',
    tradeoff: '語調がやや変わる。',
    modelRefList: ['ex_001'],
  }
}

function spec(overrides: Partial<MetricSpec> & Pick<MetricSpec, 'id'>): MetricSpec {
  return {
    path: overrides.id,
    label: '指標',
    group: '文長',
    unit: '',
    scale: 1,
    model: 10,
    before: 0,
    limit: 2,
    standout: true,
    ...overrides,
  }
}

function profile(values: Record<string, unknown>): ChapterMeasurement['profile'] {
  return values as unknown as ChapterMeasurement['profile']
}

describe('applyEdits', () => {
  test('rejects an out-of-bounds range and an overlap', () => {
    expect(() => applyEdits('abc', [candidate('x', 1, 4, 'bc', 'd')])).toThrow('Invalid edit range')
    expect(() =>
      applyEdits('abcdef', [candidate('a', 0, 3, 'abc', 'x'), candidate('b', 2, 5, 'cde', 'y')])
    ).toThrow('Overlapping candidates')
  })

  test('locates candidates by offset, not by searching for the fragment', () => {
    // 'ab' occurs twice; only the offset decides which one is replaced.
    expect(applyEdits('abXab', [candidate('a', 3, 5, 'ab', 'ZZ')])).toBe('abXZZ')
    expect(() => applyEdits('abXab', [candidate('a', 3, 5, 'aX', 'ZZ')])).toThrow(
      'Original fragment mismatch'
    )
  })

  test('applies several candidates from the end so earlier offsets stay valid', () => {
    expect(
      applyEdits('alpha beta', [
        candidate('b', 6, 10, 'beta', 'B'),
        candidate('a', 0, 5, 'alpha', 'ALPHA!!'),
      ])
    ).toBe('ALPHA!! B')
  })
})

describe('violations', () => {
  test('rejects overshoot, target regression and a new standout', () => {
    const specList = [
      spec({ id: 'target', path: 'metricList.0', model: 10, limit: 2, standout: true }),
      spec({ id: 'other', path: 'metricList.1', model: 10, limit: 2, standout: true }),
      spec({ id: 'new', path: 'metricList.2', model: 0, limit: 2, standout: false }),
    ]
    const current = { metricList: { '0': 5, '1': 8, '2': 0 } }
    const proposed = { metricList: { '0': 15, '1': 7, '2': 3 } }
    const { problemList: problemList, improved } = violations(specList, current, proposed)
    const reasonList = problemList.map(problem => `${problem.target}:${problem.reason}`)
    expect(reasonList).toContain('target:overshoot')
    expect(reasonList).toContain('other:targetRegression')
    expect(reasonList).toContain('new:newStandout')
    expect(improved).toEqual([])
  })

  test('ignores regression on a standout the candidates did not address', () => {
    const specList = [
      spec({ id: 'target', path: 'metricList.0', model: 10, limit: 2, standout: true }),
      spec({ id: 'other', path: 'metricList.1', model: 10, limit: 2, standout: true }),
    ]
    const current = { metricList: { '0': 5, '1': 8 } }
    const proposed = { metricList: { '0': 7, '1': 7 } }
    const { problemList: problemList, improved } = violations(specList, current, proposed, [
      'target',
    ])
    expect(problemList).toEqual([])
    expect(improved).toEqual(['target'])
  })

  test('reports noImprovement when nothing moved closer', () => {
    const specList = [
      spec({ id: 'target', path: 'metricList.0', model: 10, limit: 2, standout: true }),
    ]
    const value = { metricList: { '0': 5 } }
    const { problemList: problemList } = violations(specList, value, value, ['target'])
    expect(problemList).toEqual([{ target: null, reason: 'noImprovement' }])
  })
})

describe('validateReview', () => {
  const plan = { targetList: [spec({ id: 'm' })] }
  const original = 'alpha beta'
  const review = (): CandidatesFile => ({
    candidateList: [
      candidate('c1', 0, 5, 'alpha', 'ALPHA'),
      candidate('c2', 6, 10, 'beta', 'BETA'),
    ],
    targetReviewList: [{ target: 'm', reason: 'whole chapter' }],
  })

  test('requires target conclusions and standout targets', () => {
    const accepted = validateReview(plan, review(), original, EXEMPLAR_LIST)
    expect(accepted.map(entry => entry.id)).toEqual(['c1', 'c2'])

    const missing = { ...review(), targetReviewList: [] }
    expect(() => validateReview(plan, missing, original, EXEMPLAR_LIST)).toThrow(
      'whole-chapter conclusion'
    )

    const offTarget = review()
    offTarget.candidateList![0]!.targetList = ['other']
    expect(() => validateReview(plan, offTarget, original, EXEMPLAR_LIST)).toThrow(
      'standout target'
    )
  })

  test('keeps numbers and existing quotations', () => {
    const quoted = '3回の「挑戦」でした。'
    const number: CandidatesFile = {
      candidateList: [candidate('c1', 0, 2, '3回', '4回')],
      targetReviewList: [{ target: 'm', reason: 'r' }],
    }
    expect(() => validateReview(plan, number, quoted, EXEMPLAR_LIST)).toThrow('factual number')

    const quote: CandidatesFile = {
      candidateList: [candidate('c1', 3, 7, '「挑戦」', '「試み」')],
      targetReviewList: [{ target: 'm', reason: 'r' }],
    }
    expect(() => validateReview(plan, quote, quoted, EXEMPLAR_LIST)).toThrow('existing quotation')
  })

  test('accepts a rewrite that keeps the same numbers in the same order', () => {
    const source = '3回やった。'
    const ok: CandidatesFile = {
      candidateList: [candidate('c1', 0, 5, '3回やった', '3回試した')],
      targetReviewList: [{ target: 'm', reason: 'r' }],
    }
    expect(validateReview(plan, ok, source, EXEMPLAR_LIST).length).toBe(1)
  })

  test('rejects duplicate ids, empty copy, unknown exemplars and a bad bundle', () => {
    const duplicate: CandidatesFile = {
      candidateList: [
        candidate('c1', 0, 5, 'alpha', 'ALPHA'),
        candidate('c1', 6, 10, 'beta', 'BETA'),
      ],
      targetReviewList: [{ target: 'm', reason: 'r' }],
    }
    expect(() => validateReview(plan, duplicate, original, EXEMPLAR_LIST)).toThrow(
      'Duplicate candidate IDs'
    )

    const noCopy = review()
    delete noCopy.candidateList![0]!.tradeoff
    expect(() => validateReview(plan, noCopy, original, EXEMPLAR_LIST)).toThrow(
      'reason and meaning/voice effect required'
    )

    const badRef = review()
    badRef.candidateList![0]!.modelRefList = ['ex_999']
    expect(() => validateReview(plan, badRef, original, EXEMPLAR_LIST)).toThrow(
      'existing model-media exemplar IDs'
    )

    const badBundle: CandidatesFile = { ...review(), bundleList: [['c1', 'c9']] }
    expect(() => validateReview(plan, badBundle, original, EXEMPLAR_LIST)).toThrow(
      'Invalid candidate bundle'
    )

    const unchanged: CandidatesFile = {
      candidateList: [candidate('c1', 0, 5, 'alpha', 'alpha')],
      targetReviewList: [{ target: 'm', reason: 'r' }],
    }
    expect(() => validateReview(plan, unchanged, original, EXEMPLAR_LIST)).toThrow(
      'Empty or unchanged candidate'
    )
  })

  test('requires a reason on every target conclusion', () => {
    const blank: CandidatesFile = {
      ...review(),
      targetReviewList: [{ target: 'm', reason: '  ' }],
    }
    expect(() => validateReview(plan, blank, original, EXEMPLAR_LIST)).toThrow(
      'Target conclusions require reasons'
    )
  })
})

describe('evaluateCandidates', () => {
  test('measures only the original and the combined text', () => {
    const target = spec({ id: 'sentence.lengthDist.mean', model: 10, limit: 20, standout: true })
    const plan = { targetList: [target], metricList: [target], section: 0 }
    const review: CandidatesFile = {
      candidateList: [
        candidate('a', 0, 5, 'alpha', 'ALPHA', target.id),
        candidate('b', 6, 10, 'beta', 'BETA', target.id),
      ],
      targetReviewList: [{ target: target.id, reason: 'bundle is jointly effective' }],
      bundleList: [['a', 'b']],
    }
    const measured: string[] = []
    const measure = (text: string): ChapterMeasurement => {
      measured.push(text)
      return {
        profile: profile({ sentence: { lengthDist: { mean: text === 'ALPHA BETA' ? 10 : 20 } } }),
        countList: {},
      }
    }

    const result = evaluateCandidates({
      plan,
      original: 'alpha beta',
      review,
      exemplarIdList: EXEMPLAR_LIST,
      measure,
    })
    expect(result.selected).toEqual(['a', 'b'])
    expect(measured).toEqual(['alpha beta', 'ALPHA BETA'])
    expect(result.problemList).toEqual([])
    expect(result.stepList).toEqual([{ added: ['a', 'b'], improved: [target.id] }])
    expect(result.residualList[0]!.status).toBe('reached')
    expect(result.residualList[0]!.reason).toBe('bundle is jointly effective')
    expect(result.revisedText).toBe('ALPHA BETA')
    expect(result.revisedSha256).toBe(sha256String('ALPHA BETA'))
  })

  test('reports a regression without dropping candidates', () => {
    const target = spec({ id: 'm', path: 'm', model: 10, limit: 20, standout: true })
    const plan = { targetList: [target], metricList: [target], section: 0 }
    const review: CandidatesFile = {
      candidateList: [candidate('a', 0, 5, 'alpha', 'ALPHA')],
      targetReviewList: [{ target: 'm', reason: 'r' }],
    }
    const valueList = [12, 14]
    let calls = 0
    const measure = (): ChapterMeasurement => {
      const value = valueList[calls]!
      calls += 1
      return { profile: profile({ m: value }), countList: {} }
    }

    const result = evaluateCandidates({
      plan,
      original: 'alpha',
      review,
      exemplarIdList: EXEMPLAR_LIST,
      measure,
    })
    expect(result.selected).toEqual(['a'])
    expect(result.problemList.map(problem => problem.reason)).toContain('targetRegression')
    expect(calls).toBe(2)
  })

  test('flags a change that only moved the denominator', () => {
    const target = spec({ id: 'r', path: 'r', model: 10, limit: 20, standout: true })
    const plan = { targetList: [target], metricList: [target], section: 0 }
    const review: CandidatesFile = {
      candidateList: [candidate('a', 0, 5, 'alpha', 'ALPHA', 'r')],
      targetReviewList: [{ target: 'r', reason: 'r' }],
    }
    // Ratio rises towards the model value while the numerator stays put: only the denominator moved.
    const stateList = [
      { value: 8, numerator: 80, denominator: 1000 },
      { value: 9, numerator: 80, denominator: 900 },
    ]
    let calls = 0
    const measure = (): ChapterMeasurement => {
      const state = stateList[calls]!
      calls += 1
      return {
        profile: profile({ r: state.value }),
        countList: {
          r: { numerator: state.numerator, denominator: state.denominator, occurrenceList: [] },
        },
      }
    }

    const result = evaluateCandidates({
      plan,
      original: 'alpha',
      review,
      exemplarIdList: EXEMPLAR_LIST,
      measure,
    })
    expect(result.problemList).toEqual([{ target: 'r', reason: 'denominatorOnly' }])
  })

  test('an empty candidate list measures once and produces no steps', () => {
    const target = spec({ id: 'm', path: 'm', model: 10, limit: 20, standout: true })
    const plan = { targetList: [target], metricList: [target], section: 3 }
    const review: CandidatesFile = {
      candidateList: [],
      targetReviewList: [{ target: 'm', reason: 'r' }],
    }
    let calls = 0
    const measure = (): ChapterMeasurement => {
      calls += 1
      return { profile: profile({ m: 12 }), countList: {} }
    }

    const result = evaluateCandidates({
      plan,
      original: 'alpha',
      review,
      exemplarIdList: EXEMPLAR_LIST,
      measure,
    })
    expect(calls).toBe(1)
    expect(result.selected).toEqual([])
    expect(result.problemList).toEqual([])
    expect(result.stepList).toEqual([])
    expect(result.residualList.length).toBe(1)
    expect(result.revisedText).toBe('alpha')
  })

  test('flags a declared target that did not improve at all', () => {
    const addressed = spec({ id: 'a', path: 'a', model: 10, limit: 20, standout: true })
    const other = spec({ id: 'b', path: 'b', model: 10, limit: 20, standout: true })
    const plan = { targetList: [addressed, other], metricList: [addressed, other], section: 0 }
    const review: CandidatesFile = {
      candidateList: [candidate('c1', 0, 5, 'alpha', 'ALPHA', 'a')],
      targetReviewList: [
        { target: 'a', reason: 'r' },
        { target: 'b', reason: 'r' },
      ],
    }
    const valueList = [
      { a: 12, b: 12 },
      { a: 12, b: 11 },
    ]
    let calls = 0
    const measure = (): ChapterMeasurement => {
      const value = valueList[calls]!
      calls += 1
      return { profile: profile(value), countList: {} }
    }

    const result = evaluateCandidates({
      plan,
      original: 'alpha',
      review,
      exemplarIdList: EXEMPLAR_LIST,
      measure,
    })
    // 'b' improved but was never declared, so it is not even checked: only declared targets are.
    // Both reasons therefore fire together, which is how the legacy checks are defined.
    expect(result.problemList).toEqual([
      { target: null, reason: 'noImprovement' },
      { target: null, reason: 'declaredTargetNotImproved' },
    ])
  })
})

describe.skipIf(!hasSeriesConfig)('publish', () => {
  const original = 'alpha'
  const digest = sha256String('ALPHA')
  const edit = candidate('a', 0, 5, original, 'ALPHA')
  const target = spec({ id: 'm', path: 'm', model: 10, label: '指標', unit: '', standout: true })
  const plan = {
    version: REVISION_VERSION,
    section: 0,
    label: 'はじめに',
    sourceHashList: {},
    sourceFile: 'scope-00.md',
    sourceLineList: [1],
    originalSha256: sha256String(original),
    blockList: [],
    metricList: [target],
    targetList: [target],
    countList: {},
    modelExamples: config
      ? relative(config.root, join(config.pathList.modelProfile, 'exemplarBank.jsonl'))
      : '',
    instructions: '',
  }
  const review: CandidatesFile = {
    candidateList: [edit],
    finalReview: { revisedSha256: digest, verdict: 'approved', reason: '確認済み' },
  }
  const ratioList = { caseParticles: 0.1, quantifiers: 0.02 }
  const cached: EvaluationPayload = {
    version: REVISION_VERSION,
    section: 0,
    selected: ['a'],
    problemList: [],
    stepList: [],
    residualList: [],
    revisedSha256: digest,
    revisedText: 'ALPHA',
    measurementList: {
      before: { m: 12, lsmCategory: { ratioList: ratioList } },
      after: { m: 10, lsmCategory: { ratioList: ratioList } },
    },
    search: '',
  }
  const model = { lsmCategory: { ratioList: ratioList } } as never

  test('reuses a saved evaluation that still matches the approved text', () => {
    expect(selectCachedEvaluation(original, review, cached)).toBe(cached)
  })

  test('refuses a saved evaluation that no longer matches', () => {
    expect(selectCachedEvaluation(original, review, null)).toBeNull()
    expect(
      selectCachedEvaluation(original, review, { ...cached, revisedSha256: 'other' })
    ).toBeNull()
    expect(
      selectCachedEvaluation(original, review, { ...cached, selected: ['missing'] })
    ).toBeNull()
    expect(
      selectCachedEvaluation(original, { ...review, finalReview: { verdict: 'pending' } }, cached)
    ).toBeNull()
    // The candidate no longer applies to this text, so the cached revision cannot be rebuilt.
    expect(selectCachedEvaluation('other', review, cached)).toBeNull()
  })

  test('builds the published data without re-measuring', () => {
    const data = buildPublishData({ plan, original, review, result: cached, model, scope: 0 })
    expect(data.version).toBe(REVISION_VERSION)
    expect(data.revisionStatus).toBe('complete')
    expect(data.originalTextSha256).toBe(sha256String(original))
    expect(data.revisedTextSha256).toBe(digest)
    expect(Object.keys(data.editList[0]!)).not.toContain('isolated')
    expect(data.editList[0]!.target).toBe('m')
    expect(data.editList[0]!.metricPath).toBe('m')
    expect(data.editList[0]!.label).toBe('指標')
    expect(data.editList[0]!.sourceLine).toBe(1)
    expect(data.metricList.length).toBe(2)
    expect(data.metricList[0]!.movement).toBe('縮小')
    expect(data.metricList[1]!.path).toBe('lsm.mean')
    expect(data.metricList[1]!.before).toBe(1)
    expect(data.metricList[1]!.movement).toBeUndefined()
    expect(data.finalReview).toEqual(review.finalReview!)
  })

  test('keeps a stored isolated measurement on the published edit', () => {
    const isolated = { model: 10, before: 12, after: 11 }
    const withIsolated: CandidatesFile = { ...review, candidateList: [{ ...edit, isolated }] }
    const data = buildPublishData({
      plan,
      original,
      review: withIsolated,
      result: cached,
      model,
      scope: 0,
    })
    expect(data.editList[0]!.isolated).toEqual(isolated)
    // Publish never computes it: the candidate's own key order is preserved and extended.
    expect(Object.keys(data.editList[0]!)).toEqual([
      'id',
      'start',
      'end',
      'before',
      'after',
      'targetList',
      'displayReason',
      'tradeoff',
      'modelRefList',
      'isolated',
      'target',
      'metricPath',
      'label',
      'sourceLine',
    ])
  })
})

describe('applyRefreshedCopy', () => {
  const edit = candidate('c1', 0, 5, 'alpha', 'ALPHA')

  function published(): PublishedDiffData {
    return {
      version: REVISION_VERSION,
      revisionStatus: 'complete',
      section: 0,
      label: 'はじめに',
      sourceFile: 'scope-00.md',
      sourceHashList: {},
      originalTextSha256: 'a',
      revisedTextSha256: 'b',
      editList: [{ ...edit, displayReason: '古い説明。', tradeoff: '古い副作用。' }],
      metricList: [],
      measurementList: { before: {}, after: {} },
      residualList: [],
      finalReview: { verdict: 'approved' },
    }
  }

  test('updates only the copy and leaves the measurements untouched', () => {
    const data = published()
    const review: CandidatesFile = {
      candidateList: [
        { ...edit, displayReason: '語尾を整える。', tradeoff: '語調が柔らかくなる。' },
      ],
    }
    const result = applyRefreshedCopy(data, review)
    expect(result.changed.length).toBe(1)
    expect(result.data.editList[0]!.displayReason).toBe('語尾を整える。')
    expect(result.data.editList[0]!.tradeoff).toBe('語調が柔らかくなる。')
    expect(result.data.measurementList).toEqual({ before: {}, after: {} })
    expect(result.data.finalReview).toEqual({ verdict: 'approved' })
  })

  test('reports nothing changed when the copy already matches', () => {
    const data = published()
    const review: CandidatesFile = {
      candidateList: [{ ...data.editList[0] } as RevisionCandidate],
    }
    expect(applyRefreshedCopy(data, review).changed).toEqual([])
  })

  test('rejects a changed or removed published edit', () => {
    for (const candidateList of [[{ ...edit, after: 'different' }], []]) {
      expect(() => applyRefreshedCopy(published(), { candidateList: candidateList })).toThrow(
        '説明文だけの更新はできません'
      )
    }
  })

  test('rejects duplicate candidate ids', () => {
    expect(() => applyRefreshedCopy(published(), { candidateList: [edit, edit] })).toThrow(
      'Duplicate candidate IDs'
    )
  })
})
