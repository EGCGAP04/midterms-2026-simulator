// The light/dark theme (docs/SPEC.md §4.1): the browser's until the reader
// picks one, then remembered in this browser. index.html applies a stored
// choice before the first paint.

import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** A stored theme if it is valid, otherwise undefined. */
export function parseTheme(value: string | null): Theme | undefined {
  return value === 'light' || value === 'dark' ? value : undefined
}

function storedTheme(): Theme | undefined {
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY))
  } catch {
    return undefined // Storage can be blocked (e.g. private browsing).
  }
}

function browserTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [chosen, setChosen] = useState(storedTheme)
  const [browser, setBrowser] = useState(browserTheme)
  const theme = chosen ?? browser

  // Follow the browser while the reader has not picked a theme.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const update = () => setBrowser(query.matches ? 'dark' : 'light')
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const choose = (next: Theme) => {
    setChosen(next)
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // The choice still holds until the page is reloaded.
    }
  }
  return [theme, choose]
}
