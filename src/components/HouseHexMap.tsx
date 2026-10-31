// The House map (docs/SPEC.md §4.4): a hexagon per district in the colour of
// its rating at the slider, grouped by state, with the states' borders and
// postal codes on top.

import { useId, useMemo } from 'react'
import { useI18n } from '../i18n/context.ts'
import type { ChamberView } from '../state/forecast.ts'
import { HEX_SIZE, houseLayout } from '../state/houseLayout.ts'
import { HatchPattern, MapLegend, MapTooltip } from './MapParts.tsx'
import { ratingClass, useRaceMap } from './useRaceMap.ts'

interface HouseHexMapProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  onSelect: (id: string | undefined) => void
}

// The layout is fixed: build it once.
const LAYOUT = houseLayout()

export function HouseHexMap({ view, selected, onSelect }: HouseHexMapProps) {
  const { t } = useI18n()
  const hatch = `hatch-${useId()}`
  const { races } = view
  const { describe, raceProps, mapProps, tip, ringed } = useRaceMap(view, selected, onSelect)
  const { width, height, hexes, borders, labels } = LAYOUT

  const raceIndex = useMemo(() => new Map(races.map((race, k) => [race.id, k])), [races])
  const hexOf = (id: string) => hexes.find((hex) => hex.id === id)
  const hasFixed = races.some((race) => race.fixedWinner !== undefined)
  const tipHex = tip && hexOf(tip.race.id)

  return (
    <section className="map">
      <div className="map-frame" style={{ aspectRatio: `${width} / ${height}` }}>
        <svg className="map-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t('map.house')} {...mapProps}>
          <defs>
            <HatchPattern id={hatch} />
          </defs>

          {hexes.map((hex) => {
            const k = raceIndex.get(hex.id)
            // Every district has a race (checked in houseLayout.test.ts).
            if (k === undefined) return null
            const details = describe(k)
            return (
              <g key={hex.id}>
                <path className={`map-state map-race ${ratingClass(details.rating)}`} d={hex.d} {...raceProps(details)} />
                {details.race.fixedWinner !== undefined && (
                  <path className="map-hatch" d={hex.d} fill={`url(#${hatch})`} aria-hidden="true" />
                )}
              </g>
            )
          })}

          <path className="map-borders" d={borders} aria-hidden="true" />
          {labels.map(({ postal, at }) => (
            <text key={postal} className="map-label" x={at[0]} y={at[1]} aria-hidden="true">
              {postal}
            </text>
          ))}

          {/* Drawn last, so no neighbour covers the outline. */}
          {ringed.map((id) => (
            <g key={id} className="map-ring" aria-hidden="true">
              <path d={hexOf(id)?.d} />
            </g>
          ))}
        </svg>

        {tip && tipHex && (
          // It points at the hexagon's top.
          <MapTooltip tip={tip} at={[tipHex.centre[0], tipHex.centre[1] - HEX_SIZE / 2]} width={width} height={height} />
        )}
      </div>

      <MapLegend hasFixed={hasFixed}>
        <p className="map-hint">{t('map.hint.house')}</p>
        <p className="map-hint">{t('map.layout.house')}</p>
      </MapLegend>
    </section>
  )
}
