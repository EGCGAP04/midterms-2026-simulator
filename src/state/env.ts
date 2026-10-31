// Slider values (docs/SPEC.md §4.2): rounding, the keyboard steps and the
// colours along the track.

import { ENV_KEY_STEP, ENV_MAX, ENV_MIN, ENV_SHIFT_STEP } from '../model/config.ts'
import type { Bucket } from '../model/ratings.ts'

/** Rounds an environment to the slider's 0.01-point step. */
export function roundEnv(env: number): number {
  // Rounding in hundredths of a point keeps −8.75 exact (−875 / 10000).
  return Math.round(env * 10_000) / 10_000
}

const ARROWS = new Map([
  ['ArrowRight', 1],
  ['ArrowUp', 1],
  ['ArrowLeft', -1],
  ['ArrowDown', -1],
])

type ArrowKey = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>

/** How far an arrow key moves the slider (right and up toward R), or
 * undefined for any other key, or with Alt, Ctrl or Meta held. */
export function arrowStep(event: ArrowKey): number | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined
  const sign = ARROWS.get(event.key)
  if (sign === undefined) return undefined
  return sign * (event.shiftKey ? ENV_SHIFT_STEP : ENV_KEY_STEP)
}

/** Moves an environment by a step, rounded and kept within the slider range. */
export function stepEnv(env: number, step: number): number {
  return Math.min(ENV_MAX, Math.max(ENV_MIN, roundEnv(env + step)))
}

/** The margins, in points, at which the track reaches each rating's colour.
 * Past the last one it stays at Safe. */
export const TINT_STOPS: readonly (readonly [number, Bucket])[] = [
  [2, 'tilt'],
  [4, 'lean'],
  [8, 'likely'],
  [16, 'safe'],
]

const EVEN_COLOUR = '--color-even'

/** The colour at an environment, as a mix of two CSS custom properties: `mix`
 * of `hi` and the rest of `lo`. */
export interface Tint {
  lo: string
  hi: string
  mix: number
}

export function tintAt(env: number): Tint {
  const points = Math.abs(roundEnv(env)) * 100
  const side = env < 0 ? 'd' : 'r'
  let lo = EVEN_COLOUR
  let from = 0
  for (const [stop, bucket] of TINT_STOPS) {
    const hi = `--${side}-${bucket}`
    if (points <= stop) return { lo, hi, mix: (points - from) / (stop - from) }
    lo = hi
    from = stop
  }
  return { lo, hi: lo, mix: 1 }
}

/** The track's colour stops, left to right, as "var(--d-safe) 26.53%". */
export function trackStops(): string[] {
  const at = (env: number) => `${(((env - ENV_MIN) / (ENV_MAX - ENV_MIN)) * 100).toFixed(2)}%`
  const stops = (side: 'd' | 'r', sign: number) =>
    TINT_STOPS.map(([points, bucket]) => `var(--${side}-${bucket}) ${at((sign * points) / 100)}`)
  return [...stops('d', -1).reverse(), `var(${EVEN_COLOUR}) ${at(0)}`, ...stops('r', 1)]
}
