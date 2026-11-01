// Loads the House district map (docs/SPEC.md §4.4): the Census Bureau's 2026
// districts, fetched on their own the first time the map is shown, and
// projected into the states map's frame (975 × 610), so both line up.

import { geoAlbersUsa, geoPath } from 'd3-geo'
import { useEffect, useState } from 'react'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { ATLAS_HEIGHT, ATLAS_WIDTH } from './atlas.ts'

export type DistrictsTopology = Topology<{
  districts: GeometryCollection<{ id: string; state: string; STATEFP: string; plan: string }>
  states: GeometryCollection<{ state: string; STATEFP: string }>
}>

export interface DistrictShape {
  /** The race's id, e.g. `CA-22` or `AK-AL`. */
  id: string
  /** The SVG path. */
  d: string
  /** Where the tooltip points, in map units. */
  centroid: [number, number]
  /** Its bounding box, `[[x0, y0], [x1, y1]]`, in map units. */
  bounds: [[number, number], [number, number]]
}

export interface DistrictMap {
  districts: DistrictShape[]
  /** The borders between states, as one SVG path. */
  borders: string
}

/** Albers USA at `us-atlas`'s scale, centred in its frame. */
const projection = geoAlbersUsa()
  .scale(1300)
  .translate([ATLAS_WIDTH / 2, ATLAS_HEIGHT / 2])

/** Projects every district and the state borders. */
export function districtMap(topology: DistrictsTopology): DistrictMap {
  // Two decimals are a hundredth of a map unit: finer than a pixel even when
  // zoomed in, and shorter paths than the default three.
  const path = geoPath(projection).digits(2)
  const districts = feature(topology, topology.objects.districts).features.map((district) => {
    const { id } = district.properties
    const d = path(district)
    if (!d) throw new Error(`District ${id} has no shape on the map`)
    return { id, d, centroid: path.centroid(district), bounds: path.bounds(district) }
  })
  const borders = path(mesh(topology, topology.objects.states, (a, b) => a !== b)) ?? ''
  return { districts, borders }
}

const DISTRICTS_URL = `${import.meta.env.BASE_URL}us-house-districts-2026.json`

// Loaded once per page: switching maps or chambers does not fetch it again.
let loading: Promise<DistrictMap> | undefined
let loaded: DistrictMap | undefined

function loadDistricts(): Promise<DistrictMap> {
  loading ??= fetch(DISTRICTS_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`district map: HTTP ${response.status}`)
      return response.json() as Promise<DistrictsTopology>
    })
    .then((topology) => (loaded = districtMap(topology)))
    .catch((error: unknown) => {
      // Let the next try fetch it again.
      loading = undefined
      throw error
    })
  return loading
}

export type DistrictsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; map: DistrictMap }

export function useDistricts(): DistrictsState {
  // Once loaded, the map shows at once, without a loading message.
  const [state, setState] = useState<DistrictsState>(() =>
    loaded ? { status: 'ready', map: loaded } : { status: 'loading' },
  )

  useEffect(() => {
    if (loaded) return
    let cancelled = false
    loadDistricts()
      .then((map) => {
        if (!cancelled) setState({ status: 'ready', map })
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
