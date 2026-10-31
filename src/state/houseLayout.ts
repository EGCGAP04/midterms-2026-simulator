// The House map's shapes (docs/SPEC.md §4.4), from the layout that
// scripts/house_hexes.ts generates: a hexagon per district, the borders
// between states and a label per state.

import { cellCentre, cellKey, hexCorners, neighbours, type Cell } from './hexGrid.ts'
import layout from './houseHexes.json'

/** A hexagon's width in the map's units, which keeps strokes and text the
 * same size as on the Senate map. */
export const HEX_SIZE = 24
/** Room around the hexagons, in the map's units. */
const MARGIN = 4

export interface HexShape {
  /** The district's race id. */
  id: string
  postal: string
  /** The SVG path. */
  d: string
  centre: [number, number]
}

export interface HouseLayout {
  width: number
  height: number
  hexes: HexShape[]
  /** One path with every side shared by two states or facing the outside. */
  borders: string
  /** Where each state's postal code goes: the middle of its hexagons. */
  labels: { postal: string; at: [number, number] }[]
}

const point = ([x, y]: readonly [number, number]) => `${+x.toFixed(2)},${+y.toFixed(2)}`

/** The generated layout: each district's cell. */
const CELLS = layout as unknown as Readonly<Record<string, Cell>>

export function houseLayout(cells = CELLS): HouseLayout {
  const entries = Object.entries(cells)
  const centres = entries.map(([, cell]) => cellCentre(cell))
  const minX = Math.min(...centres.map(([x]) => x))
  const minY = Math.min(...centres.map(([, y]) => y))
  // From grid units to the map's, with the top-left hexagon's corner at MARGIN.
  const place = ([x, y]: readonly [number, number]): [number, number] => [
    (x - minX + 0.5) * HEX_SIZE + MARGIN,
    (y - minY + 1 / Math.sqrt(3)) * HEX_SIZE + MARGIN,
  ]

  const stateAt = new Map(entries.map(([id, cell]) => [cellKey(cell), id.slice(0, 2)]))
  const hexes: HexShape[] = []
  const sides: string[] = []
  const sums = new Map<string, { x: number; y: number; n: number }>()
  for (const [id, cell] of entries) {
    const postal = id.slice(0, 2)
    const centre = cellCentre(cell)
    const corners = hexCorners(centre).map(place)
    hexes.push({ id, postal, d: `M${corners.map(point).join('L')}Z`, centre: place(centre) })
    neighbours(cell).forEach((next, i) => {
      const across = stateAt.get(cellKey(next))
      // A side between two states is drawn once, from the cell with the lower key.
      if (across === postal || (across !== undefined && cellKey(next) < cellKey(cell))) return
      sides.push(`M${point(corners[i])}L${point(corners[(i + 1) % 6])}`)
    })
    const sum = sums.get(postal) ?? { x: 0, y: 0, n: 0 }
    sums.set(postal, { x: sum.x + centre[0], y: sum.y + centre[1], n: sum.n + 1 })
  }

  const maxX = Math.max(...hexes.map(({ centre }) => centre[0]))
  const maxY = Math.max(...hexes.map(({ centre }) => centre[1]))
  return {
    width: maxX + HEX_SIZE / 2 + MARGIN,
    height: maxY + HEX_SIZE / Math.sqrt(3) + MARGIN,
    hexes,
    borders: sides.join(''),
    labels: [...sums].map(([postal, { x, y, n }]) => ({ postal, at: place([x / n, y / n]) })),
  }
}
