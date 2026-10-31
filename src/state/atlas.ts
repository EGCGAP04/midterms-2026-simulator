// Loads the states map (docs/SPEC.md §4.4): us-atlas's states, already
// projected (Albers USA, 975 × 610), fetched on their own so the main bundle
// stays small.

import { geoPath } from 'd3-geo'
import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import atlasUrl from 'us-atlas/states-albers-10m.json?url'
import { POSTAL_BY_FIPS } from '../model/states.ts'

export type StatesTopology = Topology<{ states: GeometryCollection<{ name: string }> }>

/** The map's size in its own units. */
export const ATLAS_WIDTH = 975
export const ATLAS_HEIGHT = 610

export interface StateShape {
  postal: string
  /** The SVG path. */
  d: string
  /** Where the tooltip points, in map units. */
  centroid: [number, number]
}

/** Every state's outline, in the atlas's order (by FIPS code). */
export function stateShapes(topology: StatesTopology): StateShape[] {
  // The coordinates are already projected: no projection.
  const path = geoPath()
  return feature(topology, topology.objects.states).features.map((state) => {
    const postal = POSTAL_BY_FIPS[String(state.id)]
    if (postal === undefined) throw new Error(`Unknown state in the atlas: ${state.id}`)
    return { postal, d: path(state) ?? '', centroid: path.centroid(state) }
  })
}

export type AtlasState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; states: StateShape[] }

export function useAtlas(): AtlasState {
  const [state, setState] = useState<AtlasState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(atlasUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`states map: HTTP ${response.status}`)
        return response.json() as Promise<StatesTopology>
      })
      .then((topology) => {
        if (!cancelled) setState({ status: 'ready', states: stateShapes(topology) })
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
