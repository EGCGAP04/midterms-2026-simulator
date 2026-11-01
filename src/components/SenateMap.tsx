// The Senate map (docs/SPEC.md §4.4): every state with a race in the colour
// of its rating at the slider, the others in grey, and squares for the small
// North-East states.

import { useId, useMemo } from 'react'
import { useI18n } from '../i18n/context.ts'
import { ATLAS_HEIGHT, ATLAS_WIDTH, useAtlas } from '../state/atlas.ts'
import type { ChamberView } from '../state/forecast.ts'
import type { MapColours } from '../state/url.ts'
import { HatchPatterns, MapLegend, MapTooltip } from './MapParts.tsx'
import { hatchFill, racePaint, useRaceMap } from './useRaceMap.ts'

interface SenateMapProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  onSelect: (id: string | undefined) => void
  colours: MapColours
}

/** The small states that also get a square, top to bottom. */
const SMALL_STATES = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD']
const SQUARE = 30
const SQUARE_GAP = 6
const SQUARE_X = 925
const SQUARE_TOP = 150

function squareAt(index: number): { x: number; y: number } {
  return { x: SQUARE_X, y: SQUARE_TOP + index * (SQUARE + SQUARE_GAP) }
}

export function SenateMap({ view, selected, onSelect, colours }: SenateMapProps) {
  const { t } = useI18n()
  const atlas = useAtlas()
  const hatch = `hatch-${useId()}`
  const { races } = view
  const { describe, pointer, raceProps, mapProps, tip, ringed } = useRaceMap(view, selected, onSelect)

  // Each state's race, by postal code (one per state in 2026).
  const raceIndex = useMemo(() => new Map(races.map((race, k) => [race.state, k])), [races])

  if (atlas.status !== 'ready') {
    return (
      <section className="map">
        <div className="map-frame">
          <p className="status" role={atlas.status === 'error' ? 'alert' : 'status'}>
            {t(atlas.status === 'error' ? 'map.loadError' : 'map.loading')}
          </p>
        </div>
      </section>
    )
  }

  const shapeOf = (postal: string) => atlas.states.find((shape) => shape.postal === postal)
  // The tooltip points at a small state's square, otherwise at the state.
  const anchor = (postal: string): [number, number] | undefined => {
    const small = SMALL_STATES.indexOf(postal)
    if (small !== -1) {
      const { x, y } = squareAt(small)
      return [x + SQUARE / 2, y]
    }
    return shapeOf(postal)?.centroid
  }
  const tipAt = tip && anchor(tip.race.state)
  const rings = ringed.flatMap((id) => races.find((race) => race.id === id)?.state ?? [])

  return (
    <section className="map">
      <div className="map-frame">
        <svg
          className="map-svg"
          viewBox={`0 0 ${ATLAS_WIDTH} ${ATLAS_HEIGHT}`}
          role="group"
          aria-label={t('map.senate')}
          {...mapProps}
        >
          <defs>
            <HatchPatterns id={hatch} />
          </defs>

          {atlas.states.map((shape) => {
            const k = raceIndex.get(shape.postal)
            if (k === undefined) {
              return <path key={shape.postal} className="map-state map-no-race" d={shape.d} aria-hidden="true" />
            }
            const details = describe(k)
            const paint = racePaint(details, colours)
            return (
              <g key={shape.postal}>
                <path className={`map-state map-race ${paint.fill}`} d={shape.d} {...raceProps(details)} />
                {paint.hatch && <path className="map-hatch" d={shape.d} fill={hatchFill(hatch, paint.hatch)} aria-hidden="true" />}
              </g>
            )
          })}

          {SMALL_STATES.map((postal, index) => {
            const { x, y } = squareAt(index)
            const k = raceIndex.get(postal)
            const paint = k === undefined ? undefined : racePaint(describe(k), colours)
            const race = k === undefined ? undefined : races[k]
            return (
              <g
                key={postal}
                className={`map-square ${paint ? `map-race ${paint.fill}` : 'map-no-race'}`}
                aria-hidden="true"
                {...(race && pointer(race.id))}
              >
                <rect className="map-state" x={x} y={y} width={SQUARE} height={SQUARE} />
                {paint?.hatch && <rect x={x} y={y} width={SQUARE} height={SQUARE} fill={hatchFill(hatch, paint.hatch)} />}
                <text x={x + SQUARE / 2} y={y + SQUARE / 2}>
                  {postal}
                </text>
              </g>
            )
          })}

          {/* Drawn last, so no neighbour covers the outline. */}
          {rings.map((postal) => {
            const small = SMALL_STATES.indexOf(postal)
            const square = small === -1 ? undefined : squareAt(small)
            return (
              <g key={postal} className="map-ring" aria-hidden="true">
                <path d={shapeOf(postal)?.d} />
                {square && <rect x={square.x} y={square.y} width={SQUARE} height={SQUARE} />}
              </g>
            )
          })}
        </svg>

        {tip && tipAt && <MapTooltip tip={tip} at={tipAt} width={ATLAS_WIDTH} height={ATLAS_HEIGHT} />}
      </div>

      <MapLegend noRace={t('map.noRace.senate')} colours={colours}>
        <p className="map-hint">{t('map.hint.senate')}</p>
      </MapLegend>
    </section>
  )
}
