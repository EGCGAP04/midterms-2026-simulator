// Ratings (docs/SPEC.md §3.2): the same thresholds in both chambers.

import { LEAN_MIN, LIKELY_MIN, SAFE_MIN } from './config.ts'
import type { Outcome } from './margin.ts'
import type { Party } from './types.ts'

export type Bucket = 'tilt' | 'lean' | 'likely' | 'safe'

export interface Rating {
  bucket: Bucket
  /** The side ahead: R, D, or I when an independent leads (shown in violet). */
  party: Party
}

export const BUCKETS: readonly Bucket[] = ['tilt', 'lean', 'likely', 'safe']

export function bucketOf(margin: number): Bucket {
  const size = Math.abs(margin)
  if (size >= SAFE_MIN) return 'safe'
  if (size >= LIKELY_MIN) return 'likely'
  if (size >= LEAN_MIN) return 'lean'
  return 'tilt'
}

export function ratingOf(outcome: Outcome): Rating {
  return { bucket: bucketOf(outcome.margin), party: outcome.winner }
}

export type RatingCounts = Record<Party, Record<Bucket, number>>

function emptyCounts(): Record<Bucket, number> {
  return { tilt: 0, lean: 0, likely: 0, safe: 0 }
}

/** How many races fall in each rating, by the party ahead. */
export function countRatings(ratings: readonly Rating[]): RatingCounts {
  const counts: RatingCounts = { R: emptyCounts(), D: emptyCounts(), I: emptyCounts() }
  for (const rating of ratings) counts[rating.party][rating.bucket] += 1
  return counts
}
