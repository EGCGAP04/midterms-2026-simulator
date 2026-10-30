// Locale-aware numbers (docs/SPEC.md §4, i18n). Never format by hand.

import type { Party } from '../model/types.ts'
import { translate, type Lang } from './i18n.ts'

export const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-AR' }

function byLang(options: Intl.NumberFormatOptions): Record<Lang, Intl.NumberFormat> {
  return {
    en: new Intl.NumberFormat(LOCALES.en, options),
    es: new Intl.NumberFormat(LOCALES.es, options),
  }
}

const POINTS = byLang({ minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PERCENT = byLang({ style: 'percent', maximumFractionDigits: 0 })

/** A margin (a fraction, R − opposition) as "D+8.75", or "EVEN" when it rounds
 * to 0. `ahead` names the party ahead when it is not R or D (an independent). */
export function formatMargin(lang: Lang, margin: number, ahead?: Party): string {
  const points = POINTS[lang].format(Math.abs(margin) * 100)
  if (points === POINTS[lang].format(0)) return translate(lang, 'margin.even')
  return `${ahead ?? (margin > 0 ? 'R' : 'D')}+${points}`
}

/** A win probability as a whole percentage, with ">99%" and "<1%" at the extremes. */
export function formatProbability(lang: Lang, probability: number): string {
  if (probability > 0.99) return `>${PERCENT[lang].format(0.99)}`
  if (probability < 0.01) return `<${PERCENT[lang].format(0.01)}`
  return PERCENT[lang].format(probability)
}
