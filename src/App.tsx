// The page: header, slider, summary bar and map.

import { useDeferredValue, useEffect, useState } from 'react'
import { Header } from './components/Header.tsx'
import { HouseDistrictMap } from './components/HouseDistrictMap.tsx'
import { HouseHexMap } from './components/HouseHexMap.tsx'
import { SenateMap } from './components/SenateMap.tsx'
import { Slider } from './components/Slider.tsx'
import { SummaryBar } from './components/SummaryBar.tsx'
import { Toggle } from './components/Toggle.tsx'
import { LangContext, useI18n } from './i18n/context.ts'
import { translate } from './i18n/i18n.ts'
import type { Simulator } from './model/simulate.ts'
import type { Chamber, Dataset } from './model/types.ts'
import { useDataset } from './state/dataset.ts'
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

/** Everything that depends on the forecast, once it has loaded. */
function Forecast({ chamber, env, houseMap, onHouseMapChange, dataset, simulator }: ForecastProps) {
  const { t } = useI18n()
  const view = useChamberView(dataset, simulator, chamber, env)
  // The selected race (§4.4); the side panel (M5) will show it.
  const [selected, setSelected] = useState<string>()
  return (
    <>
      <SummaryBar view={view} />
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
            <HouseDistrictMap view={view} selected={selected} onSelect={setSelected} />
          ) : (
            <HouseHexMap view={view} selected={selected} onSelect={setSelected} />
          )}
        </>
      ) : (
        <SenateMap view={view} selected={selected} onSelect={setSelected} />
      )}
    </>
  )
}

export default function App() {
  const [state, setState] = useState<PageState>(() => readUrlState(window.location.search, navigator.languages))
  const data = useDataset()
  const [theme, setTheme] = useTheme()
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
        theme={theme}
        onChamberChange={(chamber) => setState((s) => ({ ...s, chamber }))}
        onLangChange={(lang) => setState((s) => ({ ...s, lang }))}
        onThemeChange={setTheme}
      />
      <main>
        <Slider env={state.env} onChange={(env) => setState((s) => ({ ...s, env }))} />
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
