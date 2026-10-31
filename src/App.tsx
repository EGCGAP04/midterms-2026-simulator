// The page: header, slider, summary bar, map, race panel, seat histogram and
// lists.

import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Header } from './components/Header.tsx'
import { HouseDistrictMap } from './components/HouseDistrictMap.tsx'
import { HouseHexMap } from './components/HouseHexMap.tsx'
import { RaceLists } from './components/RaceLists.tsx'
import { RacePanel } from './components/RacePanel.tsx'
import { SeatHistogram } from './components/SeatHistogram.tsx'
import { SenateMap } from './components/SenateMap.tsx'
import { Slider } from './components/Slider.tsx'
import { SummaryBar } from './components/SummaryBar.tsx'
import { Toggle } from './components/Toggle.tsx'
import { LangContext, useI18n } from './i18n/context.ts'
import { translate } from './i18n/i18n.ts'
import type { Simulator } from './model/simulate.ts'
import type { Chamber, Dataset } from './model/types.ts'
import { useDataset } from './state/dataset.ts'
import { stepEnv } from './state/env.ts'
import { useChamberView } from './state/forecast.ts'
import { useTheme } from './state/theme.ts'
import { readUrlState, writeUrlState, type HouseMap, type PageState } from './state/url.ts'

/** How long the state must stay still before the URL is updated. */
const URL_DELAY_MS = 300

interface ForecastProps {
  chamber: Chamber
  env: number
  houseMap: HouseMap
  onHouseMapChange: (houseMap: HouseMap) => void
  dataset: Dataset
  simulator: Simulator
}

/** Scrolls the race panel into view when its top is off the screen: on narrow
 * screens it sits above the lists (§4.7). Wide screens keep it in view. */
function revealPanel(panel: HTMLElement | null) {
  if (!panel) return
  const { top } = panel.getBoundingClientRect()
  if (top >= 0 && top < window.innerHeight) return
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  panel.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
}

/** Everything that depends on the forecast, once it has loaded. */
function Forecast({ chamber, env, houseMap, onHouseMapChange, dataset, simulator }: ForecastProps) {
  const { t } = useI18n()
  const view = useChamberView(dataset, simulator, chamber, env)
  // The selected race (§4.4), shown by the race panel (§4.5) and picked on
  // the map or in the lists (§4.7). It belongs to its chamber: switching
  // chambers clears it.
  const [selection, setSelection] = useState<{ chamber: Chamber; id: string }>()
  const selected = selection?.chamber === chamber ? selection.id : undefined
  const onSelect = (id: string | undefined) => setSelection(id === undefined ? undefined : { chamber, id })
  const panel = useRef<HTMLElement>(null)
  // A race picked in the lists: show it in the panel, wherever that is. Once
  // the panel has grown to show it, or the browser's scroll anchoring would
  // undo the scroll; each pick counts, even of the same race.
  const [picks, setPicks] = useState(0)
  const onListSelect = (id: string | undefined) => {
    onSelect(id)
    if (id !== undefined) setPicks((n) => n + 1)
  }
  useLayoutEffect(() => {
    if (picks > 0) revealPanel(panel.current)
  }, [picks])
  return (
    <>
      <SummaryBar view={view} />
      <div className="forecast-body">
        <div className="forecast-map">
          {chamber === 'house' ? (
            <>
              <div className="map-switch">
                <Toggle
                  label={t('map.view.label')}
                  options={[
                    { value: 'districts', label: t('map.view.districts') },
                    { value: 'hex', label: t('map.view.hex') },
                  ]}
                  value={houseMap}
                  onChange={onHouseMapChange}
                />
              </div>
              {houseMap === 'districts' ? (
                <HouseDistrictMap view={view} selected={selected} onSelect={onSelect} />
              ) : (
                <HouseHexMap view={view} selected={selected} onSelect={onSelect} />
              )}
            </>
          ) : (
            <SenateMap view={view} selected={selected} onSelect={onSelect} />
          )}
        </div>
        <RacePanel ref={panel} view={view} selected={selected} />
        <SeatHistogram view={view} />
        <RaceLists view={view} selected={selected} onSelect={onListSelect} />
      </div>
    </>
  )
}

export default function App() {
  const [state, setState] = useState<PageState>(() => readUrlState(window.location.search, navigator.languages))
  const data = useDataset()
  const [theme, setTheme] = useTheme()
  // The slider stays responsive while the forecast catches up.
  const env = useDeferredValue(state.env)
  // Stable, so the slider's page-wide key listener is added once.
  const stepSlider = useCallback((step: number) => setState((s) => ({ ...s, env: stepEnv(s.env, step) })), [])

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
        theme={theme}
        onChamberChange={(chamber) => setState((s) => ({ ...s, chamber }))}
        onLangChange={(lang) => setState((s) => ({ ...s, lang }))}
        onThemeChange={setTheme}
      />
      <main>
        <Slider env={state.env} onChange={(env) => setState((s) => ({ ...s, env }))} onStep={stepSlider} />
        {data.status === 'ready' ? (
          <Forecast
            chamber={state.chamber}
            env={env}
            houseMap={state.houseMap}
            onHouseMapChange={(houseMap) => setState((s) => ({ ...s, houseMap }))}
            dataset={data.dataset}
            simulator={data.simulator}
          />
        ) : (
          <p className="status" role={data.status === 'error' ? 'alert' : 'status'}>
            {translate(state.lang, data.status === 'error' ? 'app.loadError' : 'app.loading')}
          </p>
        )}
      </main>
    </LangContext>
  )
}
