// The pieces the maps draw (docs/SPEC.md §4.4): the hatch for fixed races,
// the tooltip, the zoom buttons and the legend.

import type { CSSProperties, ReactNode } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatProbability } from '../i18n/format.ts'
import type { MapZoom } from './useMapZoom.ts'
import type { RaceDetails } from './useRaceMap.ts'

/** White stripes over a fixed race's fill. */
export function HatchPattern({ id }: { id: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <rect className="map-hatch-stripe" width="2" height="6" />
    </pattern>
  )
}

interface MapTooltipProps {
  tip: RaceDetails
  /** Where it points, in the map's units. */
  at: readonly [number, number]
  width: number
  height: number
}

export function MapTooltip({ tip, at, width, height }: MapTooltipProps) {
  const { lang, t } = useI18n()
  return (
    <div
      className={`map-tooltip${at[1] < height / 3 ? ' map-tooltip-below' : ''}`}
      style={{ '--x': at[0] / width, '--y': at[1] / height } as CSSProperties}
      aria-hidden="true"
    >
      <strong>{tip.name}</strong>
      <span>
        {tip.ratingText}
        {tip.margin && ` · ${tip.margin}`}
      </span>
      <span>{t('map.chance', { party: tip.rating.party, chance: formatProbability(lang, tip.chance, { decided: tip.race.fixedWinner !== undefined }) })}</span>
    </div>
  )
}

/** Zoom in, zoom out and reset, in the map's top-right corner. */
export function MapZoomControls({ zoom }: { zoom: MapZoom }) {
  const { t } = useI18n()
  const buttons = [
    { label: t('map.zoom.in'), onClick: zoom.zoomIn, disabled: !zoom.canZoomIn, icon: 'M5 12h14M12 5v14' },
    { label: t('map.zoom.out'), onClick: zoom.zoomOut, disabled: !zoom.zoomed, icon: 'M5 12h14' },
    // Four corners: back to the whole map.
    {
      label: t('map.zoom.reset'),
      onClick: zoom.reset,
      disabled: !zoom.zoomed,
      icon: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    },
  ]
  return (
    <div className="map-zoom" role="group" aria-label={t('map.zoom.label')}>
      {buttons.map(({ label, onClick, disabled, icon }) => (
        <button key={label} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={icon} />
          </svg>
        </button>
      ))}
    </div>
  )
}

interface MapLegendProps {
  /** What the grey means, if the map has any. */
  noRace?: string
  hasFixed: boolean
  /** The lines under the legend. */
  children: ReactNode
}

export function MapLegend({ noRace, hasFixed, children }: MapLegendProps) {
  const { t } = useI18n()
  return (
    <>
      {(noRace !== undefined || hasFixed) && (
        <ul className="map-legend">
          {noRace !== undefined && (
            <li>
              <span className="map-swatch map-no-race" />
              {noRace}
            </li>
          )}
          {hasFixed && (
            <li>
              <span className="map-swatch map-swatch-fixed" />
              {t('map.fixed')}
            </li>
          )}
        </ul>
      )}
      {children}
    </>
  )
}
