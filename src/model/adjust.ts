// Local adjustments (docs/SPEC.md §3.5): shifts of a state's or a House
// district's baseline margin, before the slider.

import { ADJ_MAX, ADJ_ROUND } from './config.ts'
import { mt3Shares } from './margin.ts'
import type { Race } from './types.ts'

/** Shifts by key, R − opposition as fractions: a state's postal code ("TX")
 * or a House district's race id ("TX-09"). */
export type Adjustments = ReadonlyMap<string, number>

export const NO_ADJUSTMENTS: Adjustments = new Map()

/** A state's postal code, or a House district's id ("TX-09", "AK-AL"). */
const KEY = /^[A-Z]{2}(-(\d{2}|AL))?$/

export function isAdjustmentKey(key: string): boolean {
  return KEY.test(key)
}

/** Whether a key is a state's (not a district's). */
export function isStateKey(key: string): boolean {
  return key.length === 2
}

/** A shift rounded to 0.1 points and kept within ±ADJ_MAX. */
export function clampShift(shift: number): number {
  const rounded = Math.round(shift / ADJ_ROUND) * ADJ_ROUND
  // Rounding by a fraction leaves float noise ("0.025000000000000001").
  return Number(Math.min(ADJ_MAX, Math.max(-ADJ_MAX, rounded)).toFixed(3))
}

/** States first, then districts, each in alphabetical order. */
export function adjustmentOrder(a: string, b: string): number {
  return Number(isStateKey(b)) - Number(isStateKey(a)) || a.localeCompare(b)
}

/** A race's shift: its state's, plus its own district's in the House. */
export function raceShift(race: Race, adjustments: Adjustments): number {
  const own = race.chamber === 'house' ? (adjustments.get(race.id) ?? 0) : 0
  return (adjustments.get(race.state) ?? 0) + own
}

/** A race with its baseline shifted by `shift`. Fixed races do not move. */
export function shiftRace(race: Race, shift: number): Race {
  if (shift === 0 || race.fixedWinner !== undefined) return race
  if (race.type === 'MT3' && race.shares) {
    return { ...race, shares: { ...race.shares, ...mt3Shares(race.shares, shift) } }
  }
  return { ...race, m0: race.m0 + shift }
}

/** Every race with its shift; the same array when there are none, so the
 * forecast is exactly the unadjusted one. */
export function adjustRaces(races: readonly Race[], adjustments: Adjustments): readonly Race[] {
  if (![...adjustments.values()].some((shift) => shift !== 0)) return races
  return races.map((race) => shiftRace(race, raceShift(race, adjustments)))
}
