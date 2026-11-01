// The pieces the maps draw (docs/SPEC.md §4.4): the hatch for flips, the
// tooltip, the zoom buttons and the legend.

import type { CSSProperties, ReactNode } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatProbability } from '../i18n/format.ts'
import type { MapColours } from '../state/url.ts'
import type { MapZoom } from './useMapZoom.ts'
import type { RaceDetails } from './useRaceMap.ts'

/** The stripes' period and width, in map units at zoom 1. */
const HATCH_PERIOD = 4.5
const HATCH_WIDTH = 1.5

interface HatchPatternsProps {
  id: string
  /** The map's zoom level: the stripes shrink by it, so they keep their width
   * on screen and a zoomed-in district shows more of them. */
  zoom?: number
}

/** The stripes over a flip, in the winner's colour: `${id}-d`, `${id}-r` and
 * `${id}-i`. A pattern takes its colours from where it is defined, not from
 * the shape that uses it, hence one per party. */
export function HatchPatterns({ id, zoom = 1 }: HatchPatternsProps) {
  return (
    <>
      {(['d', 'r', 'i'] as const).map((party) => (
        <pattern
          key={party}
          id={`${id}-${party}`}
          patternUnits="userSpaceOnUse"
          width={HATCH_PERIOD}
          height={HATCH_PERIOD}
          patternTransform={`scale(${1 / zoom}) rotate(45)`}
        >
          <rect className={`map-hatch-stripe map-hatch-stripe-${party}`} width={HATCH_WIDTH} height={HATCH_PERIOD} />
        </pattern>
      ))}
    </>
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
  colours: MapColours
  /** The lines under the legend. */
  children: ReactNode
}

export function MapLegend({ noRace, colours, children }: MapLegendProps) {
  const { t } = useI18n()
  return (
    <>
      <ul className="map-legend">
        {noRace !== undefined && (
          <li>
            <span className="map-swatch map-no-race" />
            {noRace}
          </li>
        )}
        {colours === 'flips' && (
          <li>
            <span className="map-swatch map-swatch-hold" />
            {t('map.legend.hold')}
          </li>
        )}
        <li>
          <span className={`map-swatch map-swatch-flip${colours === 'flips' ? ' map-swatch-flip-dark' : ''}`} />
          {t('map.legend.flip')}
        </li>
      </ul>
      {children}
    </>
  )
}
