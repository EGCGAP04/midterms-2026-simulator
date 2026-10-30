// The page language for components: `useI18n()` gives it and a bound `t`.

import { createContext, useContext } from 'react'
import { translate, type Lang, type MessageKey } from './i18n.ts'

export const LangContext = createContext<Lang>('en')

export function useI18n(): { lang: Lang; t: (key: MessageKey, params?: Record<string, string | number>) => string } {
  const lang = useContext(LangContext)
  return { lang, t: (key, params) => translate(lang, key, params) }
}
