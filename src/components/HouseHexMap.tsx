// The House map (docs/SPEC.md §4.4): a hexagon per district in the colour of
// its rating at the slider, grouped by state, with the states' borders and
// postal codes on top.

import { useId, useMemo } from 'react'
import { useI18n } from '../i18n/context.ts'
import type { ChamberView } from '../state/forecast.ts'
import type { MapColours } from '../state/url.ts'
import { HEX_SIZE, houseLayout } from '../state/houseLayout.ts'
import { HatchPatterns, hatchFill, MapLegend, MapTooltip, MapZoomControls } from './MapParts.tsx'
import { useMapZoom, type ZoomRequest } from './useMapZoom.ts'
import { racePaint, useRaceMap } from './useRaceMap.ts'

interface HouseHexMapProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  onSelect: (id: string | undefined) => void
  /** The race picked in the search, to zoom to. */
  zoomRequest?: ZoomRequest
  colours: MapColours
}

/** Every hexagon has the same size: at 360 px wide, they are about 8 px across
 * and 50 px at this zoom. */
const MAX_ZOOM = 6
/** The zoom for a district picked in the search (§4.4). */
const SEARCH_ZOOM = 4

// The layout is fixed: build it once.
const LAYOUT = houseLayout()

export function HouseHexMap({ view, selected, onSelect, zoomRequest, colours }: HouseHexMapProps) {
  const { t } = useI18n()
  const hatch = `hatch-${useId()}`
  const { races } = view
  const { describe, raceProps, mapProps, tip, ringed } = useRaceMap(view, selected, onSelect)
  const { width, height, hexes, borders, labels } = LAYOUT
  const hexOf = (id: string) => hexes.find((hex) => hex.id === id)
  const { svgRef, ...zoom } = useMapZoom(
    width,
    height,
    MAX_ZOOM,
    selected === undefined ? undefined : hexOf(selected)?.centre,
    zoomRequest && { key: zoomRequest.key, at: hexOf(zoomRequest.id)?.centre, k: SEARCH_ZOOM },
  )

  const raceIndex = useMemo(() => new Map(races.map((race, k) => [race.id, k])), [races])
  const tipHex = tip && hexOf(tip.race.id)
  // It points at the hexagon's top.
  const tipAt = tipHex && zoom.place([tipHex.centre[0], tipHex.centre[1] - HEX_SIZE / 2])

  return (
    <section className="map">
      <div className="map-frame" style={{ aspectRatio: `${width} / ${height}` }}>
        <svg
          ref={svgRef}
          className={`map-svg map-zoomable${zoom.zoomed ? ' map-zoomed' : ''}`}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={t('map.house')}
          style={zoom.style}
          // Zoomed in, Tab brings each district into view.
          onFocus={(event) => {
            const at = hexOf(event.target.getAttribute('data-race') ?? '')?.centre
            if (at) zoom.follow(at)
          }}
          {...mapProps}
        >
          <defs>
            <HatchPatterns id={hatch} />
          </defs>

          <g transform={zoom.transform.toString()}>
            {hexes.map((hex) => {
              const k = raceIndex.get(hex.id)
              // Every district has a race (checked in houseLayout.test.ts).
              if (k === undefined) return null
              const details = describe(k)
              const paint = racePaint(details, colours)
              return (
                <g key={hex.id}>
                  <path className={`map-state map-race ${paint.fill}`} d={hex.d} {...raceProps(details)} />
                  {paint.hatch && <path className="map-hatch" d={hex.d} fill={hatchFill(hatch, paint.hatch)} aria-hidden="true" />}
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
          </g>
        </svg>

        <MapZoomControls zoom={zoom} />
        {tip && tipAt && <MapTooltip tip={tip} at={tipAt} width={width} height={height} />}
      </div>

      <MapLegend colours={colours}>
        <p className="map-hint">{t('map.hint.house')}</p>
        <p className="map-hint">{t('map.zoom.hint')}</p>
        <p className="map-hint">{t('map.layout.house')}</p>
      </MapLegend>
    </section>
  )
}
