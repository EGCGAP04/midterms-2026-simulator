// Flips (docs/SPEC.md §4.5): a race whose side ahead is not the party that
// holds the seat.

import type { Outcome } from './margin.ts'
import type { Party, Race } from './types.ts'

export interface Flip {
  from: Party
  to: Party
}

/** The flip at this outcome, or undefined when the holder stays ahead. */
export function flipOf(race: Race, outcome: Outcome): Flip | undefined {
  return outcome.winner === race.holder ? undefined : { from: race.holder, to: outcome.winner }
}
