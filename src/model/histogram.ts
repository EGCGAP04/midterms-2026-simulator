// The seat histogram's bars and ticks (docs/SPEC.md §4.6).

export interface SeatBars {
  /** The fewest and the most seats any simulation gives. */
  lo: number
  hi: number
  /** `shares[s - lo]`: the share of simulations that end at `s` seats. */
  shares: number[]
}

/** The bars from `lo` to `hi`, leaving out the empty counts at either end.
 * Undefined if no simulation is counted. */
export function seatBars(histogram: Uint32Array): SeatBars | undefined {
  const lo = histogram.findIndex((count) => count > 0)
  if (lo === -1) return undefined
  const hi = histogram.findLastIndex((count) => count > 0)
  const n = histogram.reduce((sum, count) => sum + count, 0)
  const shares = Array.from(histogram.subarray(lo, hi + 1), (count) => count / n)
  return { lo, hi, shares }
}

const TICK_STEPS = [1, 2, 5, 10, 20, 50]

/** Round seat counts between `lo` and `hi`, at most `max` of them (more only
 * on a range wider than 50 × `max`). With `max` 8 there is always one: a
 * step is used only when the one before gives more than 8. */
export function seatTicks(lo: number, hi: number, max = 8): number[] {
  const step = TICK_STEPS.find((s) => Math.floor(hi / s) - Math.ceil(lo / s) + 1 <= max) ?? TICK_STEPS[TICK_STEPS.length - 1]
  const ticks: number[] = []
  for (let tick = Math.ceil(lo / step) * step; tick <= hi; tick += step) ticks.push(tick)
  return ticks
}
