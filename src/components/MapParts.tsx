// The pieces both maps draw (docs/SPEC.md §4.4): the hatch for fixed races,
// the tooltip and the legend.

import type { CSSProperties, ReactNode } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatProbability } from '../i18n/format.ts'
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
        {tip.ratingText} · {tip.margin}
      </span>
      <span>{t('map.chance', { party: tip.rating.party, chance: formatProbability(lang, tip.chance) })}</span>
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
