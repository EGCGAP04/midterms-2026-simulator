// Seat totals (docs/SPEC.md §3.4).

import type { Outcome } from './margin.ts'
import type { Party } from './types.ts'

export type SeatTotals = Record<Party, number>

/** Seats won by each party, plus the seats not up for election (Senate). */
export function seatTotals(outcomes: readonly Outcome[], notUp: Partial<SeatTotals> = {}): SeatTotals {
  const totals: SeatTotals = { R: notUp.R ?? 0, D: notUp.D ?? 0, I: notUp.I ?? 0 }
  for (const outcome of outcomes) totals[outcome.winner] += 1
  return totals
}
