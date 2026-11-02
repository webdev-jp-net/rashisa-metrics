/** 形態素1件。解析器を差し替えても計測コードを変えずに済むよう、計測が使うフィールドだけに絞る。 */
export interface Token {
  surface: string
  pos1: string
  pos2: string
  lemma: string
  /** このtokenの出典文書のindex（複数文書をまとめて計測するため）。 */
  document: number
}

/** 形態素解析器のアダプタ。`name`は各プロファイルの`measurement.tokenizer`に記録される。 */
export interface Tokenizer {
  name: string
  /**
   * @param text 解析するテキスト。
   * @param document 出典文書のindex。各トークンに付ける。
   * @returns トークン列。
   */
  tokenize(text: string, document: number): Token[]
}
