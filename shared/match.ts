/**
 * Antra — fuzzy name matching for the public API. Shortcuts send human names
 * ("HDFC Credit Card", "food and dining") which we resolve to ids.
 */

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

/** Similarity in [0,1]; 1 = identical after normalisation. */
export function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  const dist = levenshtein(na, nb)
  const lev = 1 - dist / maxLen
  const containment = na.includes(nb) || nb.includes(na) ? 0.9 : 0
  // Token overlap (Jaccard) catches "food dining" vs "dining food".
  const ta = new Set(na.split(' ').filter(Boolean))
  const tb = new Set(nb.split(' ').filter(Boolean))
  const inter = [...ta].filter((t) => tb.has(t)).length
  const union = new Set([...ta, ...tb]).size
  const jaccard = union ? inter / union : 0
  return Math.max(lev, containment, jaccard * 0.95)
}

export const MATCH_THRESHOLD = 0.6

export interface MatchResult<T> {
  item: T
  score: number
}

/**
 * Resolve `query` to the best matching named item. Exact-normalised matches win
 * outright; otherwise the highest similarity above `threshold`.
 */
export function matchByName<T>(
  items: T[],
  query: string,
  getName: (item: T) => string,
  threshold = MATCH_THRESHOLD,
): MatchResult<T> | null {
  const nq = normalizeName(query)
  if (!nq) return null
  let best: MatchResult<T> | null = null
  for (const item of items) {
    const score = similarity(query, getName(item))
    if (!best || score > best.score) best = { item, score }
  }
  if (best && best.score >= threshold) return best
  return null
}

/**
 * Resolve an id OR fuzzy name against a list. Ids match exactly and always win.
 */
export function resolveRef<T extends { id: string }>(
  items: T[],
  ref: string | undefined | null,
  getName: (item: T) => string,
): MatchResult<T> | null {
  if (!ref) return null
  const direct = items.find((i) => i.id === ref)
  if (direct) return { item: direct, score: 1 }
  return matchByName(items, ref, getName)
}
