// The page state in the URL (docs/SPEC.md §4.8):
// `?ch=house&env=-5.25&lang=es&map=hex`.

import type { Lang } from '../i18n/i18n.ts'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN } from '../model/config.ts'
import type { Chamber } from '../model/types.ts'
import { roundEnv } from './env.ts'

/** The House map: the real districts (the default) or the hex cartogram. */
export type HouseMap = 'districts' | 'hex'

export interface PageState {
  chamber: Chamber
  /** The slider, R − D as a fraction (−0.0875 = D+8.75). */
  env: number
  lang: Lang
  houseMap: HouseMap
}

/** Spanish if the browser's first language is Spanish, English otherwise. */
export function browserLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

function parseEnv(value: string | null): number | undefined {
  if (value === null || !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(value.trim())) return undefined
  const env = roundEnv(Number(value) / 100)
  return env >= ENV_MIN && env <= ENV_MAX ? env : undefined
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
  }
}

/** The query string for a state, with `env` in points and two decimals.
 * `lang` is left out when it matches the browser language, so a shared link
 * opens in the reader's language, and `map` when it is the default. */
export function writeUrlState(state: PageState, languages: readonly string[]): string {
  const params = new URLSearchParams({ ch: state.chamber, env: (roundEnv(state.env) * 100).toFixed(2) })
  if (state.lang !== browserLang(languages)) params.set('lang', state.lang)
  if (state.houseMap === 'hex') params.set('map', 'hex')
  return `?${params}`
}
