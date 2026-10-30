// UI strings (docs/SPEC.md §4, i18n). English is the reference catalog.

import en from './en.json'
import es from './es.json'

export type Lang = 'en' | 'es'
export const LANGS: readonly Lang[] = ['en', 'es']

export type MessageKey = keyof typeof en
export type Catalog = Partial<Record<MessageKey, string>>

export const CATALOGS: Record<Lang, Catalog> = { en, es }

/** The string for `key` in `lang`, falling back to English, with every
 * `{name}` replaced by `params.name`. Unknown placeholders are left as they are. */
export function translate(lang: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  const text = CATALOGS[lang][key] ?? en[key]
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  )
}
