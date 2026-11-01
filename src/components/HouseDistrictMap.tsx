// The House district map (docs/SPEC.md §4.4): every district with its real
// 2026 shape, in the colour of its rating at the slider, with the state
// borders on top.

import { useId, useMemo } from 'react'
import { useI18n } from '../i18n/context.ts'
import { ATLAS_HEIGHT, ATLAS_WIDTH } from '../state/atlas.ts'
import { useDistricts } from '../state/districts.ts'
import type { ChamberView } from '../state/forecast.ts'
import type { MapColours } from '../state/url.ts'
import { HatchPatterns, MapLegend, MapTooltip, MapZoomControls } from './MapParts.tsx'
import { useMapZoom, type ZoomRequest, type ZoomTarget } from './useMapZoom.ts'
import { hatchFill, racePaint, useRaceMap } from './useRaceMap.ts'

/** Enough to tap New York City's districts on a phone: at 360 px wide, the
 * smallest are then about 15 × 25 px. */
const MAX_ZOOM = 40
/** How much of the frame a district picked in the search fills (§4.4). */
const SEARCH_FIT = 0.4

/** The zoom at which a box fills `SEARCH_FIT` of the frame, within the map's
 * range. */
function fitZoom([[x0, y0], [x1, y1]]: [[number, number], [number, number]]): number {
  const k = SEARCH_FIT * Math.min(ATLAS_WIDTH / Math.max(x1 - x0, 1e-6), ATLAS_HEIGHT / Math.max(y1 - y0, 1e-6))
  return Math.min(Math.max(k, 1), MAX_ZOOM)
}

interface HouseDistrictMapProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  onSelect: (id: string | undefined) => void
  /** The race picked in the search, to zoom to. */
  zoomRequest?: ZoomRequest
  colours: MapColours
}

export function HouseDistrictMap({ view, selected, onSelect, zoomRequest, colours }: HouseDistrictMapProps) {
  const { t } = useI18n()
  const loaded = useDistricts()
  const hatch = `hatch-${useId()}`
  const { races } = view
  const { describe, raceProps, mapProps, tip, ringed } = useRaceMap(view, selected, onSelect)

  const raceIndex = useMemo(() => new Map(races.map((race, k) => [race.id, k])), [races])
  // In the races' order, so Tab goes through them as listed (AL-01, AL-02…).
  const districts = useMemo(() => {
    if (loaded.status !== 'ready') return []
    const order = (id: string) => raceIndex.get(id) ?? Infinity
    return loaded.map.districts.toSorted((a, b) => order(a.id) - order(b.id))
  }, [loaded, raceIndex])
  const shapeOf = (id: string) => districts.find((district) => district.id === id)
  const picked = zoomRequest && shapeOf(zoomRequest.id)
  const target: ZoomTarget | undefined = zoomRequest && {
    key: zoomRequest.key,
    // The middle of its box, so the whole district is framed.
    at: picked && [(picked.bounds[0][0] + picked.bounds[1][0]) / 2, (picked.bounds[0][1] + picked.bounds[1][1]) / 2],
    k: picked ? fitZoom(picked.bounds) : 1,
  }
  const { svgRef, ...zoom } = useMapZoom(
    ATLAS_WIDTH,
    ATLAS_HEIGHT,
    MAX_ZOOM,
    selected === undefined ? undefined : shapeOf(selected)?.centroid,
    target,
  )

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

  const tipShape = tip && shapeOf(tip.race.id)
  const tipAt = tipShape && zoom.place(tipShape.centroid)

  return (
    <section className="map">
      <div className="map-frame">
        <svg
          ref={svgRef}
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
            <HatchPatterns id={hatch} />
          </defs>

          <g transform={zoom.transform.toString()}>
            {districts.map((district) => {
              const k = raceIndex.get(district.id)
              // Every district has a race (checked in districts.test.ts).
              if (k === undefined) return null
              const details = describe(k)
              const paint = racePaint(details, colours)
              return (
                <g key={district.id}>
                  <path className={`map-state map-race ${paint.fill}`} d={district.d} {...raceProps(details)} />
                  {paint.hatch && <path className="map-hatch" d={district.d} fill={hatchFill(hatch, paint.hatch)} aria-hidden="true" />}
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

      <MapLegend colours={colours}>
        <p className="map-hint">{t('map.hint.house')}</p>
        <p className="map-hint">{t('map.zoom.hint')}</p>
        <p className="map-hint">{t('map.credit.districts')}</p>
      </MapLegend>
    </section>
  )
}
