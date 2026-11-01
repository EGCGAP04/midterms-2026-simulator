// Finding a race by district, state or candidate (docs/SPEC.md §4.4).

import { raceName, stateName } from '../i18n/format.ts'
import { LANGS } from '../i18n/i18n.ts'
import type { Race } from '../model/types.ts'

/** How many suggestions the search shows. */
export const MAX_RESULTS = 8

/** What a race can be found by, normalized. */
export interface SearchEntry {
  /** The postal code, e.g. "ca". */
  postal: string
  /** The district number; undefined for an at-large seat and in the Senate. */
  district: number | undefined
  atLarge: boolean
  /** The words of its name and its state's name, in both languages. */
  places: string[]
  /** The words of its candidates' names. */
  candidates: string[]
}

/** Lower case, without accents or punctuation, and with letters and digits
 * apart ("CA-22" and "ca22" → "ca 22"). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const words = (texts: readonly string[]): string[] => [
  ...new Set(texts.flatMap((text) => normalize(text).split(' ')).filter(Boolean)),
]

export function searchEntry(race: Race): SearchEntry {
  const code = race.id.slice(race.id.indexOf('-') + 1)
  const names = [race.rep?.name, race.opp?.name, race.shares?.names[2]].filter((name) => name !== undefined)
  return {
    postal: race.state.toLowerCase(),
    district: /^\d+$/.test(code) ? Number(code) : undefined,
    atLarge: code === 'AL',
    places: words(LANGS.flatMap((lang) => [raceName(lang, race), stateName(lang, race.state)])),
    candidates: words(names),
  }
}

/** "David Valadao (R) · Randy Villegas (D)": the candidates, the REP slot
 * first (Montana's third too), as the suggestions show them. */
export function candidateList(race: Race): string {
  const named = [race.rep, race.opp].filter((candidate) => candidate !== null)
  const list = named.map(({ name, party }) => `${name} (${party})`)
  if (race.shares) list.push(`${race.shares.names[2]} (D)`)
  return list.join(' · ')
}

/** A whole state, found by its name (in both languages) or postal code. */
export function stateSearchEntry(postal: string): SearchEntry {
  return {
    postal: postal.toLowerCase(),
    district: undefined,
    atLarge: false,
    places: words(LANGS.map((lang) => stateName(lang, postal))),
    candidates: [],
  }
}

/** How well one word of the query matches: lower is better, undefined is no
 * match. A number must be the district's; a word the postal code, or the
 * start of a word of the place, then of a candidate. */
function tokenScore(entry: SearchEntry, token: string): number | undefined {
  if (/^\d+$/.test(token)) {
    const n = Number(token)
    return n === entry.district || (n === 1 && entry.atLarge) ? 0 : undefined
  }
  if (token === entry.postal) return 0
  if (token === 'al' && entry.atLarge) return 1
  if (entry.places.includes(token)) return 1
  if (entry.places.some((word) => word.startsWith(token))) return 2
  if (entry.candidates.includes(token)) return 3
  if (entry.candidates.some((word) => word.startsWith(token))) return 4
  return undefined
}

/** The races matching every word of `query`, the best first (ties in the
 * races' order), as indices into `entries`. */
export function searchRaces(entries: readonly SearchEntry[], query: string, limit = MAX_RESULTS): number[] {
  const tokens = normalize(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return []
  const scored: { k: number; score: number }[] = []
  entries.forEach((entry, k) => {
    let score = 0
    for (const token of tokens) {
      const s = tokenScore(entry, token)
      if (s === undefined) return
      score += s
    }
    scored.push({ k, score })
  })
  return scored
    .sort((a, b) => a.score - b.score || a.k - b.k)
    .slice(0, limit)
    .map(({ k }) => k)
}
