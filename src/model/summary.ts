// The summary bar's blocks (docs/SPEC.md §4.3): a chamber's seats by rating,
// from Safe D to Safe R, with independents in the middle on the side of the
// party they run against, and the Senate seats not up at the two ends (the
// independents not up, who caucus with D, after the D ones).

import type { Outcome } from './margin.ts'
import { BUCKETS, countRatings, ratingOf, type Bucket } from './ratings.ts'
import type { Party, Race, Senator } from './types.ts'

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
    ...(notUp.I ? [{ party: 'I', side: 'D', kind: 'notUp', seats: notUp.I } as const] : []),
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

/** Someone a block of the summary bar stands for: a race's leader at the
 * slider, or a senator not up. */
export interface Member {
  name: string
  /** The race's id ("CA-22"), or the senator's state. */
  place: string
  /** The race's margin at the slider (R − opposition); none for a fixed race
   * or a senator not up. */
  margin?: number
  /** The leader's party (the margin's side). */
  party: Party
}

/** The name of the candidate who leads a race: by party, by share in a
 * same-party race. */
export function leaderName(race: Race, outcome: Outcome): string {
  if (race.type === 'MT3' && race.shares) {
    if (outcome.winner === race.rep?.party) return race.rep.name
    if (outcome.winner === race.opp?.party) return race.opp.name
    return race.shares.names[2]
  }
  const { rep, opp } = race
  if (rep && opp && rep.party === opp.party) {
    const [repShare, oppShare] = race.intraShares ?? [1, 0]
    return repShare >= oppShare ? rep.name : opp.name
  }
  return (rep?.party === outcome.winner ? rep : opp)?.name ?? rep?.name ?? ''
}

/** Closest first: by the margin's size, the races decided before the vote
 * (no margin) last. The sort is stable, so ties keep the races' order. */
function byMargin(a: Member, b: Member): number {
  return (a.margin === undefined ? Infinity : Math.abs(a.margin)) - (b.margin === undefined ? Infinity : Math.abs(b.margin))
}

/** Who a block stands for, by result (the smallest margin first) or, for the
 * seats not up, in the senators' order. */
export function blockMembers(
  block: Block,
  races: readonly Race[],
  outcomes: readonly Outcome[],
  senators: readonly Senator[] = [],
): Member[] {
  if (block.kind === 'notUp') {
    return senators
      .filter((senator) => senator.party === block.party)
      .map(({ name, state, party }) => ({ name, place: state, party }))
  }
  const members = races.flatMap((race, k) => {
    const outcome = outcomes[k]
    const rating = ratingOf(outcome)
    const inBlock =
      block.kind === 'independent'
        ? rating.party === 'I' && independentSide(race) === block.side
        : rating.party === block.party && rating.bucket === block.kind
    if (!inBlock) return []
    const margin = race.fixedWinner === undefined ? outcome.margin : undefined
    return [{ name: leaderName(race, outcome), place: race.id, margin, party: outcome.winner }]
  })
  return members.toSorted(byMargin)
}
