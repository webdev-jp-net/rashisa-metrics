import { Fragment, type ReactNode } from 'react'
import type { FindingModel } from '../../model/types'
import styles from './FindingText.module.scss'

/**
 * 括弧の外にある「。」だけで分割する。「」『』（）の中の「。」では文を区切らない。
 *
 * @param text 総評の1段落。
 * @returns 文の配列。
 */
function splitSentenceList(text: string): string[] {
  const partList: string[] = []
  let start = 0
  let depth = 0
  const characterList = Array.from(text)
  characterList.forEach((character, index) => {
    if ('「『（('.includes(character)) depth += 1
    else if ('」』）)'.includes(character)) depth = Math.max(depth - 1, 0)
    else if (character === '。' && depth === 0) {
      partList.push(characterList.slice(start, index + 1).join(''))
      start = index + 1
    }
  })
  if (start < characterList.length) partList.push(characterList.slice(start).join(''))
  return partList
}

/**
 * 最も外側の「…」（かぎ括弧含む）を<q>で囲み、引用部分にスタイルを当てられるようにする。
 *
 * @param text 1文。
 * @returns テキストと`<q>`のノード列。
 */
function withQuoteList(text: string): ReactNode[] {
  const nodeList: ReactNode[] = []
  let plain = ''
  let quote = ''
  let depth = 0
  for (const character of text) {
    if (character === '「') {
      depth += 1
      if (depth === 1 && plain) {
        nodeList.push(plain)
        plain = ''
      }
    }
    if (depth > 0) quote += character
    else plain += character
    if (character === '」' && depth > 0) {
      depth -= 1
      if (depth === 0) {
        nodeList.push(<q key={nodeList.length}>{quote}</q>)
        quote = ''
      }
    }
  }
  if (quote) nodeList.push(<q key={nodeList.length}>{quote}</q>)
  if (plain) nodeList.push(plain)
  return nodeList
}

export interface FindingTextProps {
  finding: FindingModel
}

/**
 * 1観点分の総評を、段落・文に分けて描画する。文分割・引用マークの規則は_llm-docs/analysis/findings.md
 * （レンダリング規則）に従う。
 *
 * @param props
 * @param props.finding 1観点分の総評。
 * @returns 描画結果。
 */
export function FindingText({ finding }: FindingTextProps) {
  return (
    <div className={styles.finding}>
      <h3>{finding.heading}</h3>
      <div className={styles.body}>
        {finding.paragraphList.map((paragraph, paragraphIndex) => {
          const sentenceList = splitSentenceList(paragraph)
          return (
            <p key={paragraphIndex}>
              {sentenceList.map((sentence, sentenceIndex) => (
                <Fragment key={sentenceIndex}>
                  {withQuoteList(sentence)}
                  {sentenceIndex < sentenceList.length - 1 ? <br /> : null}
                </Fragment>
              ))}
            </p>
          )
        })}
      </div>
    </div>
  )
}
