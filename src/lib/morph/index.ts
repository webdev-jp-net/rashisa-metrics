import type { Token, Tokenizer } from './types'

export type { Token, Tokenizer } from './types'

/** 解析器なしで計測するときの実装。形態素ベースの指標は`uncomputed`になる。テストが解析器（wasm）を読み込まずに計測ロジックを検証するのに使う。 */
export const NullTokenizer: Tokenizer = {
  name: 'none',
  /**
   * @returns 常に空。
   */
  tokenize(): Token[] {
    return []
  },
}

export { LinderaUnidicTokenizer, createLinderaUnidicTokenizer } from './lindera-unidic'
