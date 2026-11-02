'use client'

import { Fragment } from 'react'
import type { DiffContextRow, DiffSegment } from '@/lib/diff'
import type { DiffBoxModel } from '../../model/types'
import { useDiffFold } from '../../useReport'
import { Icon } from '../Icon'
import styles from './DiffBox.module.scss'

/**
 * 語diffの区間。`mark`の区間だけ`<mark>`で強調する。
 *
 * @param props
 * @param props.segmentList 語diffの区間。
 * @returns 描画結果。
 */
function Segments({ segmentList }: { segmentList: DiffSegment[] }) {
  return (
    <>
      {segmentList.map((segment, index) =>
        segment.mark ? (
          <mark key={index} className={styles.mark}>
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        )
      )}
    </>
  )
}

/**
 * 変更が無い行。
 *
 * @param props
 * @param props.row 変更が無い行。
 * @returns 描画結果。
 */
function ContextLine({ row }: { row: DiffContextRow }) {
  return (
    <tr>
      <td className={styles.ln}>{row.oldNumber}</td>
      <td className={styles.code}>{row.text}</td>
      <td className={styles.ln}>{row.newNumber}</td>
      <td className={styles.code}>{row.text}</td>
    </tr>
  )
}

export interface DiffBoxProps {
  diff: DiffBoxModel
}

/**
 * diff提案1件。行diff・語diff・理由行と折りたたみ操作。
 *
 * @param props
 * @param props.diff diff提案の表示モデル。
 * @returns 描画結果。
 */
export function DiffBox({ diff }: DiffBoxProps) {
  const { expanded, revealed, reveal, toggleAll, step } = useDiffFold(diff.rowList)

  return (
    <div className={styles.diffbox}>
      <button
        type="button"
        className={styles.head}
        id={`unfold-all-${diff.scope}`}
        aria-pressed={expanded}
        onClick={toggleAll}
      >
        <span className={styles.title}>{diff.title}</span>
        <span
          className={styles.unfoldLabel}
          aria-label={expanded ? 'すべて折りたたむ' : 'すべて展開'}
        >
          <span className={styles.unfoldIcon}>
            <Icon
              name={expanded ? 'arrows-in-line-vertical' : 'arrows-out-line-vertical'}
              weight="regular"
            />
          </span>
        </span>
      </button>
      <table>
        <colgroup>
          <col className={styles.colLn} />
          <col />
          <col className={styles.colLn} />
          <col />
        </colgroup>
        <tbody id={`diff-body-${diff.scope}`}>
          {diff.rowList.map((row, index) => {
            if (row.kind === 'context') return <ContextLine key={index} row={row} />
            if (row.kind === 'changed') {
              const leftClass = row.oldNumber !== null ? styles.delSide : styles.blankSide
              const rightClass = row.newNumber !== null ? styles.insSide : styles.blankSide
              return (
                <tr key={index} className={styles.chg}>
                  <td className={`${styles.ln} ${leftClass}`}>{row.oldNumber}</td>
                  <td className={`${styles.code} ${leftClass}`}>
                    <Segments segmentList={row.left} />
                  </td>
                  <td className={`${styles.ln} ${rightClass}`}>{row.newNumber}</td>
                  <td className={`${styles.code} ${rightClass}`}>
                    <Segments segmentList={row.right} />
                  </td>
                </tr>
              )
            }
            if (row.kind === 'fold') {
              const shown = revealed[index] ?? 0
              const remaining = row.hidden.length - shown
              return (
                <Fragment key={index}>
                  {row.hidden.slice(0, shown).map((hidden, hiddenIndex) => (
                    <ContextLine key={hiddenIndex} row={hidden} />
                  ))}
                  {remaining > 0 ? (
                    <tr className={styles.fold}>
                      <td className={styles.foldIconCell}>
                        <button
                          type="button"
                          className={styles.foldButton}
                          aria-label="非表示の行を表示"
                          onClick={() => reveal(index, step)}
                        >
                          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                            <circle cx="2" cy="8" r="1.6" />
                            <circle cx="8" cy="8" r="1.6" />
                            <circle cx="14" cy="8" r="1.6" />
                          </svg>
                        </button>
                      </td>
                      <td className={styles.foldLabelCell} colSpan={3}>
                        <button
                          type="button"
                          className={styles.foldButton}
                          onClick={() => reveal(index, step)}
                        >
                          {row.header}{' '}
                          <span className={styles.foldCount}>
                            {shown === 0
                              ? `${row.hidden.length}行を非表示`
                              : `残り${remaining}行を表示`}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            }
            return (
              <tr key={index} className={styles.reasonRow}>
                <td colSpan={4}>
                  <div className={styles.reasonInline} id={row.id}>
                    <h3>{row.title}</h3>
                    <p>{row.reason}</p>
                    <p className={styles.tradeoff}>副作用：{row.tradeoff}</p>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
