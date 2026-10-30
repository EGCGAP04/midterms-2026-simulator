// Slider values (docs/SPEC.md §4.2): rounding, and the keyboard steps.

import { ENV_KEY_STEP, ENV_MAX, ENV_MIN, ENV_SHIFT_STEP } from '../model/config.ts'

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
