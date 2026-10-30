// The page: header, slider and summary bar (M3).

import { useDeferredValue, useEffect, useState } from 'react'
import { Header } from './components/Header.tsx'
import { Slider } from './components/Slider.tsx'
import { SummaryBar } from './components/SummaryBar.tsx'
import { LangContext } from './i18n/context.ts'
import { translate } from './i18n/i18n.ts'
import { useDataset } from './state/dataset.ts'
import { readUrlState, writeUrlState, type PageState } from './state/url.ts'

/** How long the state must stay still before the URL is updated. */
const URL_DELAY_MS = 300

export default function App() {
  const [state, setState] = useState<PageState>(() => readUrlState(window.location.search, navigator.languages))
  const data = useDataset()
  // The slider stays responsive while the forecast catches up.
  const env = useDeferredValue(state.env)

  useEffect(() => {
    document.documentElement.lang = state.lang
  }, [state.lang])

  // Browsers throttle frequent URL changes, so wait until the slider stops.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.history.replaceState(window.history.state, '', writeUrlState(state, navigator.languages) + window.location.hash)
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
        {data.status === 'ready' ? (
          <SummaryBar chamber={state.chamber} env={env} dataset={data.dataset} simulator={data.simulator} />
        ) : (
          <p className="status" role={data.status === 'error' ? 'alert' : 'status'}>
            {translate(state.lang, data.status === 'error' ? 'app.loadError' : 'app.loading')}
          </p>
        )}
      </main>
    </LangContext>
  )
}
