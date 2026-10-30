// Margins under the slider (docs/SPEC.md §3.1).

import { MARGIN_CAP, MT3_SHARE_MAX, MT3_SHARE_MIN } from './config.ts'
import type { Party, Race } from './types.ts'

export interface Outcome {
  /** R − opposition for two-candidate races; for MT3, Alme − the strongest
   * opponent. Fixed races keep their ±1. */
  margin: number
  winner: Party
  /** MT3 only: the shares of Alme, Bodnar and Bankhead. */
  shares?: { A: number; B: number; C: number }
}

/** The slider's offset from the workbook baseline, Δ = g − g0. */
export function deltaFrom(env: number, g0: number): number {
  return env - g0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** The party ahead in a two-candidate race at margin `margin`. Exactly 0
 * goes to the REP slot, matching the workbook. */
export function sideAhead(race: Race, margin: number): Party {
  const candidate = margin >= 0 ? race.rep : race.opp
  if (candidate === null) throw new Error(`${race.id}: no candidate on the side ahead`)
  return candidate.party
}

/** Montana's three-way shares after a shift of Δ. */
export function mt3Shares(
  shares: { A: number; B: number; C: number },
  delta: number,
): { A: number; B: number; C: number } {
  const A = clamp(shares.A + delta / 2, MT3_SHARE_MIN, MT3_SHARE_MAX)
  const opposition = 1 - A
  const rest = shares.B + shares.C
  return { A, B: (opposition * shares.B) / rest, C: (opposition * shares.C) / rest }
}

/** The outcome of a race when the national environment is Δ away from the
 * workbook baseline. */
export function outcomeAt(race: Race, delta: number): Outcome {
  if (race.fixedWinner !== undefined) {
    return { margin: race.m0, winner: race.fixedWinner }
  }
  if (race.type === 'MT3') {
    if (race.shares === undefined) throw new Error(`${race.id}: MT3 race without shares`)
    const shares = mt3Shares(race.shares, delta)
    // A is the REP slot, B the opposition slot, C the third candidate (D).
    const parties = { A: race.rep?.party ?? 'R', B: race.opp?.party ?? 'I', C: 'D' } as const
    // On a tie the earlier share wins, so Alme keeps an exact tie (Tilt R).
    const leader = (['A', 'B', 'C'] as const).reduce((best, key) => (shares[key] > shares[best] ? key : best))
    return { margin: shares.A - Math.max(shares.B, shares.C), winner: parties[leader], shares }
  }
  const cap = Math.max(MARGIN_CAP, Math.abs(race.m0))
  const margin = clamp(race.m0 + race.slope * delta, -cap, cap)
  return { margin, winner: sideAhead(race, margin) }
}
