// The summary bar's blocks (docs/SPEC.md §4.3): a chamber's seats by rating,
// from Safe D to Safe R, with independents in the middle on the side of the
// party they run against, and the Senate seats not up at the two ends.

import type { Outcome } from './margin.ts'
import { BUCKETS, countRatings, ratingOf, type Bucket } from './ratings.ts'
import type { Party, Race } from './types.ts'

export type BlockKind = Bucket | 'independent' | 'notUp'
export type Side = 'D' | 'R'

export interface Block {
  party: Party
  /** The half of the bar the block belongs to. */
  side: Side
  kind: BlockKind
  seats: number
  /** Where the block starts, as a share of the chamber (0 = left end). */
  start: number
  /** Its width, as a share of the chamber. */
  share: number
}

/** The side of an independent's race: next to R when the independent runs
 * in the REP slot (against D), next to D when in the opposition slot. */
export function independentSide(race: Race): Side {
  return race.rep?.party === 'I' ? 'R' : 'D'
}

/** Every block in bar order, empty ones included (they keep their place in
 * the table). Not-up blocks appear only when there are such seats.
 * `outcomes[k]` is the outcome of `races[k]`. */
export function summaryBlocks(
  races: readonly Race[],
  outcomes: readonly Outcome[],
  notUp: Partial<Record<Party, number>> = {},
): Block[] {
  const ratings = outcomes.map(ratingOf)
  // Independents are counted by side instead of by rating.
  const counts = countRatings(ratings)
  const independents: Record<Side, number> = { D: 0, R: 0 }
  ratings.forEach((rating, k) => {
    if (rating.party === 'I') independents[independentSide(races[k])] += 1
  })

  const safeFirst = [...BUCKETS].reverse()
  const parts: Omit<Block, 'start' | 'share'>[] = [
    ...(notUp.D ? [{ party: 'D', side: 'D', kind: 'notUp', seats: notUp.D } as const] : []),
    ...safeFirst.map((bucket) => ({ party: 'D', side: 'D', kind: bucket, seats: counts.D[bucket] }) as const),
    { party: 'I', side: 'D', kind: 'independent', seats: independents.D },
    { party: 'I', side: 'R', kind: 'independent', seats: independents.R },
    ...BUCKETS.map((bucket) => ({ party: 'R', side: 'R', kind: bucket, seats: counts.R[bucket] }) as const),
    ...(notUp.R ? [{ party: 'R', side: 'R', kind: 'notUp', seats: notUp.R } as const] : []),
  ]
  const total = parts.reduce((sum, part) => sum + part.seats, 0)
  let before = 0
  return parts.map((part) => {
    const block = { ...part, start: before / total, share: part.seats / total }
    before += part.seats
    return block
  })
}
