import { loadKeigoConfig } from './config'

/** 敬語3分類の出現数（measurement.md「敬語」）。 */
export interface KeigoHitList {
  sonkeigo: number
  kenjougo: number
  teineigo: number
}

/**
 * 敬語3分類の出現数。辞書形一致（`lemmaList`）と正規表現一致（`surfacePatternList`）を合算する。
 *
 * @param tokenList 形態素列（`lemma`だけ使う）。
 * @param normalizedText 正規表現一致の対象。トークン列でなく本文を渡す（複数語にまたがる表現のため）。
 * @returns 3分類の出現数。
 */
export function keigoCountList(
  tokenList: { lemma: string }[],
  normalizedText: string
): KeigoHitList {
  const keigo = loadKeigoConfig()
  const lemmaList = tokenList.map(t => t.lemma)
  const hitList: KeigoHitList = { sonkeigo: 0, kenjougo: 0, teineigo: 0 }
  for (const category of ['sonkeigo', 'kenjougo', 'teineigo'] as const) {
    const cat = keigo[category]
    const targetLemmaList = new Set(cat.lemmaList ?? [])
    hitList[category] += lemmaList.filter(lemma => targetLemmaList.has(lemma)).length
    for (const pattern of cat.surfacePatternList ?? []) {
      const matchList = normalizedText.match(new RegExp(pattern, 'g'))
      hitList[category] += matchList ? matchList.length : 0
    }
  }
  return hitList
}
