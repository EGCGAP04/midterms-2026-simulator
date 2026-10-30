// The summary bar's blocks (docs/SPEC.md §4.3): a chamber's seats by rating,
// from Safe D to Safe R, with independents in the middle and the Senate seats
// not up at the two ends.

import { BUCKETS, type Bucket, type RatingCounts } from './ratings.ts'
import type { Party } from './types.ts'

export type BlockKind = Bucket | 'independent' | 'notUp'

export interface Block {
  party: Party
  kind: BlockKind
  seats: number
  /** Where the block starts, as a share of the chamber (0 = left end). */
  start: number
  /** Its width, as a share of the chamber. */
  share: number
}

/** Every rating block in bar order, empty ones included (they keep their
 * place in the table). Not-up blocks appear only when there are such seats. */
export function summaryBlocks(counts: RatingCounts, notUp: Partial<Record<Party, number>> = {}): Block[] {
  const safeFirst = [...BUCKETS].reverse()
  const independents = BUCKETS.reduce((sum, bucket) => sum + counts.I[bucket], 0)
  const parts: Omit<Block, 'start' | 'share'>[] = [
    ...(notUp.D ? [{ party: 'D', kind: 'notUp', seats: notUp.D } as const] : []),
    ...safeFirst.map((bucket) => ({ party: 'D', kind: bucket, seats: counts.D[bucket] }) as const),
    { party: 'I', kind: 'independent', seats: independents },
    ...BUCKETS.map((bucket) => ({ party: 'R', kind: bucket, seats: counts.R[bucket] }) as const),
    ...(notUp.R ? [{ party: 'R', kind: 'notUp', seats: notUp.R } as const] : []),
  ]
  const total = parts.reduce((sum, part) => sum + part.seats, 0)
  let before = 0
  return parts.map((part) => {
    const block = { ...part, start: before / total, share: part.seats / total }
    before += part.seats
    return block
  })
}
