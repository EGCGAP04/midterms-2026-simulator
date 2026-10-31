// Locale-aware numbers (docs/SPEC.md §4, i18n). Never format by hand.

import type { Party, Race } from '../model/types.ts'
import { translate, type Lang, type MessageKey } from './i18n.ts'

export const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-AR' }

function byLang(options: Intl.NumberFormatOptions): Record<Lang, Intl.NumberFormat> {
  return {
    en: new Intl.NumberFormat(LOCALES.en, options),
    es: new Intl.NumberFormat(LOCALES.es, options),
  }
}

const POINTS: Record<number, Record<Lang, Intl.NumberFormat>> = {
  0: byLang({ maximumFractionDigits: 0 }),
  1: byLang({ minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  2: byLang({ minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}
const PERCENT = byLang({ style: 'percent', maximumFractionDigits: 0 })
const SHARE = byLang({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const COUNT = byLang({ maximumFractionDigits: 0 })

export interface MarginOptions {
  /** The party ahead, when it is not R or D (an independent). */
  ahead?: Party
  /** 2 (the default), 1 for the race panel's context, or 0 for the slider's ends. */
  decimals?: 0 | 1 | 2
}

/** A margin (a fraction, R − opposition) as "D+8.75", or "EVEN" when it rounds to 0. */
export function formatMargin(lang: Lang, margin: number, { ahead, decimals = 2 }: MarginOptions = {}): string {
  const format = POINTS[decimals][lang]
  const points = format.format(Math.abs(margin) * 100)
  if (points === format.format(0)) return translate(lang, 'margin.even')
  return `${ahead ?? (margin > 0 ? 'R' : 'D')}+${points}`
}

/** A whole number, with the language's thousands separator ("10,000" / "10.000"). */
export function formatCount(lang: Lang, count: number): string {
  return COUNT[lang].format(count)
}

/** A win probability as a whole percentage, with ">99%" and "<1%" at the extremes. */
export function formatProbability(lang: Lang, probability: number): string {
  if (probability > 0.99) return `>${PERCENT[lang].format(0.99)}`
  if (probability < 0.01) return `<${PERCENT[lang].format(0.01)}`
  return PERCENT[lang].format(probability)
}

/** A vote share with one decimal ("48.4%" / "48,4%"). */
export function formatShare(lang: Lang, share: number): string {
  return SHARE[lang].format(share)
}

/** A whole percentage ("56%"), without the >99% / <1% caps of probabilities. */
export function formatPercent(lang: Lang, share: number): string {
  return PERCENT[lang].format(share)
}

/** A state's name from its postal code ("NC" → "North Carolina" / "Carolina del Norte"). */
export function stateName(lang: Lang, postal: string): string {
  // Every postal code in races.json has a name (checked in i18n.test.ts).
  return translate(lang, `state.${postal}` as MessageKey)
}

/** A race's name: the state in the Senate, with "(special)" for a special
 * election; the state and district in the House ("Alabama 01", "Alaska at-large"). */
export function raceName(lang: Lang, race: Race): string {
  const state = stateName(lang, race.state)
  if (race.chamber === 'senate') {
    // The exporter keeps the workbook's names, which mark special elections.
    return race.name.endsWith(' (special)') ? translate(lang, 'race.special', { state }) : state
  }
  const district = race.id.slice(race.id.indexOf('-') + 1)
  return district === 'AL' ? translate(lang, 'race.atLarge', { state }) : translate(lang, 'race.district', { state, district })
}
