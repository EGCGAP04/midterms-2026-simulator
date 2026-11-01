// The page state in the URL (docs/SPEC.md §4.8):
// `?ch=house&env=-5.25&lang=es&map=hex&colors=flips&adj=TX:-2.5,CA-22:1`.

import type { Lang } from '../i18n/i18n.ts'
import { adjustmentOrder, clampShift, isAdjustmentKey, type Adjustments } from '../model/adjust.ts'
import { ADJ_MAX, DEFAULT_ENV, ENV_MAX, ENV_MIN } from '../model/config.ts'
import type { Chamber } from '../model/types.ts'
import { roundEnv } from './env.ts'

/** The House map: the real districts (the default) or the hex cartogram. */
export type HouseMap = 'districts' | 'hex'

/** What the maps' colours show: each race's rating (the default) or whether
 * it flips. */
export type MapColours = 'ratings' | 'flips'

export interface PageState {
  chamber: Chamber
  /** The slider, R − D as a fraction (−0.0875 = D+8.75). */
  env: number
  lang: Lang
  houseMap: HouseMap
  mapColours: MapColours
  /** The local shifts (§3.5), zero ones included while they are listed. */
  adjustments: Adjustments
}

/** Spanish if the browser's first language is Spanish, English otherwise. */
export function browserLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

/** A plain decimal number, sign optional. */
const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

function parseEnv(value: string | null): number | undefined {
  if (value === null || !NUMBER.test(value.trim())) return undefined
  const env = roundEnv(Number(value) / 100)
  return env >= ENV_MIN && env <= ENV_MAX ? env : undefined
}

/** `TX:-2.5,CA-22:1` → TX −0.025, CA-22 +0.01; invalid entries are left out. */
export function parseAdjustments(value: string | null): Adjustments {
  const adjustments = new Map<string, number>()
  for (const entry of value?.split(',') ?? []) {
    const [key, points, ...rest] = entry.trim().split(':')
    if (rest.length > 0 || points === undefined || !isAdjustmentKey(key) || !NUMBER.test(points)) continue
    const shift = Number(points) / 100
    if (Math.abs(shift) > ADJ_MAX + 1e-9) continue
    const rounded = clampShift(shift)
    if (rounded !== 0) adjustments.set(key, rounded)
  }
  return adjustments
}

/** The non-zero shifts as `TX:-2.5,CA-22:1`, states first; empty for none. */
export function writeAdjustments(adjustments: Adjustments): string {
  return [...adjustments]
    .filter(([, shift]) => clampShift(shift) !== 0)
    .sort(([a], [b]) => adjustmentOrder(a, b))
    .map(([key, shift]) => `${key}:${Number((clampShift(shift) * 100).toFixed(1))}`)
    .join(',')
}

/** Reads the state from a query string, ignoring invalid values. */
export function readUrlState(search: string, languages: readonly string[]): PageState {
  const params = new URLSearchParams(search)
  const ch = params.get('ch')
  const lang = params.get('lang')
  return {
    chamber: ch === 'senate' ? 'senate' : 'house',
    env: parseEnv(params.get('env')) ?? DEFAULT_ENV,
    lang: lang === 'en' || lang === 'es' ? lang : browserLang(languages),
    houseMap: params.get('map') === 'hex' ? 'hex' : 'districts',
    mapColours: params.get('colors') === 'flips' ? 'flips' : 'ratings',
    adjustments: parseAdjustments(params.get('adj')),
  }
}

/** The query string for a state, with `env` in points and two decimals.
 * `lang` is left out when it matches the browser language, so a shared link
 * opens in the reader's language, `map` and `colors` when they are the
 * defaults, and `adj` when there are no shifts. */
export function writeUrlState(state: PageState, languages: readonly string[]): string {
  const params = new URLSearchParams({ ch: state.chamber, env: (roundEnv(state.env) * 100).toFixed(2) })
  if (state.lang !== browserLang(languages)) params.set('lang', state.lang)
  if (state.houseMap === 'hex') params.set('map', 'hex')
  if (state.mapColours === 'flips') params.set('colors', 'flips')
  const adj = writeAdjustments(state.adjustments)
  if (adj !== '') params.set('adj', adj)
  // ":" and "," are allowed in a query string: keep `adj` readable.
  return `?${params}`.replaceAll('%3A', ':').replaceAll('%2C', ',')
}
