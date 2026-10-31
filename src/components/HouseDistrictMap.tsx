// The House district map (docs/SPEC.md §4.4): every district with its real
// 2026 shape, in the colour of its rating at the slider, with the state
// borders on top.

import { useId, useMemo } from 'react'
import { useI18n } from '../i18n/context.ts'
import { ATLAS_HEIGHT, ATLAS_WIDTH } from '../state/atlas.ts'
import { useDistricts } from '../state/districts.ts'
import type { ChamberView } from '../state/forecast.ts'
import { HatchPattern, MapLegend, MapTooltip, MapZoomControls } from './MapParts.tsx'
import { useMapZoom } from './useMapZoom.ts'
import { ratingClass, useRaceMap } from './useRaceMap.ts'

/** Enough to tap New York City's districts on a phone: at 360 px wide, the
 * smallest are then about 15 × 25 px. */
const MAX_ZOOM = 40

interface HouseDistrictMapProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  onSelect: (id: string | undefined) => void
}

export function HouseDistrictMap({ view, selected, onSelect }: HouseDistrictMapProps) {
  const { t } = useI18n()
  const loaded = useDistricts()
  const hatch = `hatch-${useId()}`
  const { races } = view
  const { describe, raceProps, mapProps, tip, ringed } = useRaceMap(view, selected, onSelect)
  const zoom = useMapZoom(ATLAS_WIDTH, ATLAS_HEIGHT, MAX_ZOOM)

  const raceIndex = useMemo(() => new Map(races.map((race, k) => [race.id, k])), [races])
  // In the races' order, so Tab goes through them as listed (AL-01, AL-02…).
  const districts = useMemo(() => {
    if (loaded.status !== 'ready') return []
    const order = (id: string) => raceIndex.get(id) ?? Infinity
    return loaded.map.districts.toSorted((a, b) => order(a.id) - order(b.id))
  }, [loaded, raceIndex])
  const hasFixed = races.some((race) => race.fixedWinner !== undefined)

  if (loaded.status !== 'ready') {
    return (
      <section className="map">
        <div className="map-frame">
          <p className="status" role={loaded.status === 'error' ? 'alert' : 'status'}>
            {t(loaded.status === 'error' ? 'map.loadError' : 'map.loading')}
          </p>
        </div>
      </section>
    )
  }

  const shapeOf = (id: string) => districts.find((district) => district.id === id)
  const tipShape = tip && shapeOf(tip.race.id)
  const tipAt = tipShape && zoom.place(tipShape.centroid)

  return (
    <section className="map">
      <div className="map-frame">
        <svg
          ref={zoom.ref}
          className={`map-svg map-districts map-zoomable${zoom.zoomed ? ' map-zoomed' : ''}`}
          viewBox={`0 0 ${ATLAS_WIDTH} ${ATLAS_HEIGHT}`}
          role="group"
          aria-label={t('map.house')}
          style={zoom.style}
          // Zoomed in, Tab brings each district into view.
          onFocus={(event) => {
            const at = shapeOf(event.target.getAttribute('data-race') ?? '')?.centroid
            if (at) zoom.follow(at)
          }}
          {...mapProps}
        >
          <defs>
            <HatchPattern id={hatch} />
          </defs>

          <g transform={zoom.transform.toString()}>
            {districts.map((district) => {
              const k = raceIndex.get(district.id)
              // Every district has a race (checked in districts.test.ts).
              if (k === undefined) return null
              const details = describe(k)
              return (
                <g key={district.id}>
                  <path className={`map-state map-race ${ratingClass(details.rating)}`} d={district.d} {...raceProps(details)} />
                  {details.race.fixedWinner !== undefined && (
                    <path className="map-hatch" d={district.d} fill={`url(#${hatch})`} aria-hidden="true" />
                  )}
                </g>
              )
            })}

            <path className="map-state-borders" d={loaded.map.borders} aria-hidden="true" />

            {/* Drawn last, so no neighbour covers the outline. */}
            {ringed.map((id) => (
              <g key={id} className="map-ring" aria-hidden="true">
                <path d={shapeOf(id)?.d} />
              </g>
            ))}
          </g>
        </svg>

        <MapZoomControls zoom={zoom} />
        {tip && tipAt && <MapTooltip tip={tip} at={tipAt} width={ATLAS_WIDTH} height={ATLAS_HEIGHT} />}
      </div>

      <MapLegend hasFixed={hasFixed}>
        <p className="map-hint">{t('map.hint.house')}</p>
        <p className="map-hint">{t('map.zoom.hint')}</p>
        <p className="map-hint">{t('map.credit.districts')}</p>
      </MapLegend>
    </section>
  )
}
