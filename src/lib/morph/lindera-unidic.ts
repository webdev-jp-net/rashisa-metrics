import { createRequire } from 'node:module'
import {
  getVersion,
  loadDictionary,
  Tokenizer as LinderaTokenizer,
} from 'lindera-wasm-unidic-nodejs'
import type { Token, Tokenizer } from './types'

const require = createRequire(import.meta.url)

/** lindera-wasm-unidic-nodejsの`tokenize`が返す形。 */
interface RawLinderaToken {
  surface: string
  details: string[]
  is_unknown: boolean
}

/**
 * プロファイルの`measurement.tokenizer`に記録する解析器のバージョン。
 *
 * @returns バージョン文字列。
 */
function resolvePackageVersion(): string {
  try {
    const pkg = require('lindera-wasm-unidic-nodejs/package.json') as { version?: unknown }
    if (typeof pkg.version === 'string' && pkg.version.length > 0) return pkg.version
  } catch {}
  return getVersion()
}

/** UniDicの`details`のindex→フィールド対応。lindera-wasm-unidic-nodejsが定めるスキーマに基づく。 */
const POS1_INDEX = 0
const POS2_INDEX = 1
const LEXEME_INDEX = 7
const ORTHOGRAPHIC_BASE_FORM_INDEX = 10

/**
 * UniDicは空欄を`'*'`で表すため、未定義と同じく欠損として扱う。
 *
 * @param detailList UniDicの素性配列。
 * @param index 素性の位置。
 * @returns 値。空欄ならundefined。
 */
function detailAt(detailList: string[], index: number): string | undefined {
  const value = detailList[index]
  return value === undefined || value === '*' ? undefined : value
}

/**
 * 計測が使う`Token`に写す。lemmaは語彙素ではなく書字形基本形を優先する。`config/*.yaml`の語彙と`lsm.ts`の語（例: しれる／知れる）が書字形で書かれているため。
 *
 * @param raw lindera-wasmのトークン。
 * @param document 出典文書のindex。
 * @returns 計測用のトークン。
 */
function toToken(raw: RawLinderaToken, document: number): Token {
  const pos1 = raw.details[POS1_INDEX] ?? ''
  const pos2Raw = raw.details[POS2_INDEX]
  const pos2 = pos2Raw === undefined || pos2Raw === '*' ? '' : pos2Raw
  const lemma =
    detailAt(raw.details, ORTHOGRAPHIC_BASE_FORM_INDEX) ??
    detailAt(raw.details, LEXEME_INDEX) ??
    raw.surface
  return { surface: raw.surface, pos1, pos2, lemma, document }
}

let cachedLinderaTokenizer: LinderaTokenizer | undefined

/**
 * 辞書の読み込みが重いため、プロセスの生存期間中は1つのトークナイザーを使い回す。
 *
 * @returns キャッシュ済みのトークナイザー。
 */
function getLinderaTokenizer(): LinderaTokenizer {
  if (!cachedLinderaTokenizer) {
    const dictionary = loadDictionary('embedded://unidic')
    cachedLinderaTokenizer = new LinderaTokenizer(dictionary, 'normal')
  }
  return cachedLinderaTokenizer
}

/** lindera-wasmのUniDic辞書で形態素解析する`Tokenizer`実装。`name`は`lindera-wasm-unidic-nodejs:<version>/unidic`の形（measurement.md「計測メタデータ」）。 */
export class LinderaUnidicTokenizer implements Tokenizer {
  readonly name: string = `lindera-wasm-unidic-nodejs:${resolvePackageVersion()}/unidic`

  /**
   * @param text 解析するテキスト。
   * @param document 出典文書のindex。各トークンに付く。
   * @returns トークン列。
   */
  tokenize(text: string, document: number): Token[] {
    const tokenList = getLinderaTokenizer().tokenize(text) as RawLinderaToken[]
    return tokenList.map(token => toToken(token, document))
  }
}

let singleton: LinderaUnidicTokenizer | undefined

/**
 * 解析器のインスタンス。常に同じものを返す。
 *
 * @returns 解析器。
 */
export function createLinderaUnidicTokenizer(): Tokenizer {
  singleton ??= new LinderaUnidicTokenizer()
  return singleton
}
