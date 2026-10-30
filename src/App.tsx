// The page: header and slider (M3). The summary bar arrives with #7.

import { useEffect, useState } from 'react'
import { Header } from './components/Header.tsx'
import { Slider } from './components/Slider.tsx'
import { LangContext } from './i18n/context.ts'
import { readUrlState, writeUrlState, type PageState } from './state/url.ts'

/** How long the state must stay still before the URL is updated. */
const URL_DELAY_MS = 300

export default function App() {
  const [state, setState] = useState<PageState>(() => readUrlState(window.location.search, navigator.languages))

  useEffect(() => {
    document.documentElement.lang = state.lang
  }, [state.lang])

  // Browsers throttle frequent URL changes, so wait until the slider stops.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.history.replaceState(window.history.state, '', writeUrlState(state) + window.location.hash)
    }, URL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [state])

  return (
    <LangContext value={state.lang}>
      <Header
        chamber={state.chamber}
        onChamberChange={(chamber) => setState((s) => ({ ...s, chamber }))}
        onLangChange={(lang) => setState((s) => ({ ...s, lang }))}
      />
      <main>
        <Slider env={state.env} onChange={(env) => setState((s) => ({ ...s, env }))} />
      </main>
    </LangContext>
  )
}
