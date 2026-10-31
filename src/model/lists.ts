// The lists under the map (docs/SPEC.md §4.7): flips, the closest races and
// the tipping-point race. Every function takes a chamber's races and their
// outcomes (`outcomes[k]` is the outcome of `races[k]`) and returns indices
// into them.

import { flipOf } from './flips.ts'
import type { Outcome } from './margin.ts'
import type { Party, Race } from './types.ts'

/** How many races the closest-races list shows. */
export const CLOSEST_COUNT = 10

/** Indices sorted by `key`, ties kept in the races' order. */
function sortedBy(count: number, key: (k: number) => number): number[] {
  return Array.from({ length: count }, (_, k) => k).sort((a, b) => key(a) - key(b) || a - b)
}

/** The flips at the slider, by the party that loses them, the clearest first
 * (fixed races, at ±100, at the top). */
export function flipsByLoser(races: readonly Race[], outcomes: readonly Outcome[]): Record<Party, number[]> {
  const lists: Record<Party, number[]> = { R: [], D: [], I: [] }
  for (const k of sortedBy(races.length, (k) => -Math.abs(outcomes[k].margin))) {
    const flip = flipOf(races[k], outcomes[k])
    if (flip) lists[flip.from].push(k)
  }
  return lists
}

/** The `count` races with the smallest margin, either side, fixed races left
 * out. */
export function closestRaces(races: readonly Race[], outcomes: readonly Outcome[], count = CLOSEST_COUNT): number[] {
  return sortedBy(races.length, (k) => Math.abs(outcomes[k].margin))
    .filter((k) => races[k].fixedWinner === undefined)
    .slice(0, count)
}

/** The race that gives control: with the races sorted from the most R margin
 * down, the one that brings R to `rControl` seats, counting `notUpR` seats
 * not up for election. It is also the one that gives the other side its
 * majority, since R controls exactly when it is R. Undefined if the races
 * cannot decide control. */
export function tippingPoint(
  races: readonly Race[],
  outcomes: readonly Outcome[],
  rControl: number,
  notUpR = 0,
): number | undefined {
  const position = rControl - notUpR - 1
  if (position < 0 || position >= races.length) return undefined
  return sortedBy(races.length, (k) => -outcomes[k].margin)[position]
}
