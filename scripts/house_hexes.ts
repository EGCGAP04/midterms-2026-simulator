// Generates the House map's layout (docs/SPEC.md §4.4), one hexagon per
// district, into src/state/houseHexes.json:
//
//   node scripts/house_hexes.ts
//
// 1. Each state starts at its centroid on the us-atlas map, as a circle with
//    the area of its districts' hexagons.
// 2. The circles push each other apart until none overlap, each pulled back
//    toward its centroid (a Dorling cartogram).
// 3. One by one, the states then grow a hexagon at a time from the free cell
//    closest to their circle's centre, always taking the free neighbouring
//    cell closest to it, so every state stays in one piece.
// 4. A hole boxed in by states moves out of the map: a state next to it
//    takes it and gives up a cell closer to the outside.
// 5. Within a state, the districts are numbered in reading order: their
//    positions do not follow the real districts.
//
// Run it again when the number of districts per state changes.

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Dataset } from '../src/model/types.ts'
import { POSTAL_BY_FIPS } from '../src/model/states.ts'
import { cellCentre, cellKey, neighbours, ROW_HEIGHT, type Cell } from '../src/state/hexGrid.ts'

/** A hexagon's width in the atlas's units: it sets how far apart the states are. */
const HEX_WIDTH = 24
/** The relaxation's steps, and how strongly a state is pulled toward its centroid. */
const STEPS = 400
const PULL = 0.08
/** How strongly every state is pulled toward the map's centre, closing the
 * gaps between the sparse western states. */
const GRAVITY = 0.008
/** How much of an overlap is undone in each step. */
const PUSH = 0.5
/** The gap between circles, in hexagon widths. */
const PADDING = 0.15
/** How far from its centre a state's first hexagon may be, in hexagons. */
const SEARCH = 12
/** The growth's preference for cells touching the state, and its neighbours. */
const TOUCH_OWN = 0.12
const TOUCH_OTHERS = 0.1
/** Moves to a few states' starting points, in hexagon widths (right, down), so
 * the crowded North-East keeps its order along the coast. */
const NUDGES: Record<string, [number, number]> = { MA: [0.5, -1], RI: [0.5, 1.5], CT: [0, 1.5], NJ: [0, 1] }

const OUT = new URL('../src/state/houseHexes.json', import.meta.url)

const dataset = JSON.parse(readFileSync(new URL('../public/races.json', import.meta.url), 'utf8')) as Dataset
const require = createRequire(import.meta.url)
const topology = JSON.parse(readFileSync(require.resolve('us-atlas/states-albers-10m.json'), 'utf8')) as Topology<{ states: GeometryCollection }>

// The districts of each state, in number order ("AK-AL" alone in its state).
const districts = new Map<string, string[]>()
for (const race of dataset.races) {
  if (race.chamber !== 'house') continue
  districts.set(race.state, [...(districts.get(race.state) ?? []), race.id])
}
for (const ids of districts.values()) ids.sort()

// 1. Centroids, in hexagon widths.
const path = geoPath()
interface Circle {
  postal: string
  seats: number
  home: [number, number]
  at: [number, number]
  radius: number
}
const circles: Circle[] = feature(topology, topology.objects.states).features.flatMap((state) => {
  const postal = POSTAL_BY_FIPS[String(state.id)]
  const seats = districts.get(postal)?.length ?? 0
  if (seats === 0) return []
  const [x, y] = path.centroid(state)
  const [dx, dy] = NUDGES[postal] ?? [0, 0]
  const home: [number, number] = [x / HEX_WIDTH + dx, y / HEX_WIDTH + dy]
  // A hexagon's area is ROW_HEIGHT (in widths squared).
  return [{ postal, seats, home, at: [...home], radius: Math.sqrt((seats * ROW_HEIGHT) / Math.PI) }]
})
if (circles.length !== districts.size) throw new Error('Some states with districts are not on the map')

// 2. The relaxation.
const seats = circles.reduce((sum, circle) => sum + circle.seats, 0)
const centre = [0, 1].map((k) => circles.reduce((sum, circle) => sum + circle.home[k] * circle.seats, 0) / seats)
for (let step = 0; step < STEPS; step++) {
  for (const circle of circles) {
    for (const k of [0, 1]) {
      circle.at[k] += (circle.home[k] - circle.at[k]) * PULL + (centre[k] - circle.at[k]) * GRAVITY
    }
  }
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i]
      const b = circles[j]
      const dx = b.at[0] - a.at[0]
      const dy = b.at[1] - a.at[1]
      const distance = Math.hypot(dx, dy) || 1e-9
      const overlap = (a.radius + b.radius + PADDING - distance) * PUSH
      if (overlap <= 0) continue
      // The smaller state moves more.
      const share = b.seats / (a.seats + b.seats)
      a.at[0] -= (dx / distance) * overlap * share
      a.at[1] -= (dy / distance) * overlap * share
      b.at[0] += (dx / distance) * overlap * (1 - share)
      b.at[1] += (dy / distance) * overlap * (1 - share)
    }
  }
}

// 3. The growth, biggest state first, so a small neighbour cannot take a big
// state's centre; the small ones then fill the room the relaxation left them.
const owner = new Map<string, string>()
const cells = new Map<string, Cell[]>()

function distance(cell: Cell, [x, y]: [number, number]): number {
  const [cx, cy] = cellCentre(cell)
  return Math.hypot(cx - x, cy - y)
}

// Every state first reserves the cell at its circle's centre, so a bigger
// neighbour growing first cannot push a small state away from its place.
const reserved = new Map<string, string>()
const seeds = new Map<string, Cell>()
const ordered = [...circles].sort((a, b) => b.seats - a.seats || a.postal.localeCompare(b.postal))
for (const circle of ordered) {
  const [x, y] = circle.at
  const row = Math.round(y / ROW_HEIGHT)
  const cell = nearestFree([Math.round(x - (row & 1) / 2), row], circle.at, (key) => reserved.has(key))
  reserved.set(cellKey(cell), circle.postal)
  seeds.set(circle.postal, cell)
}

/** The cell near `start` closest to `centre` that is not taken and has `room` cells around it. */
function nearestFree(start: Cell, centre: [number, number], taken: (key: string) => boolean, room = 1): Cell {
  const near: Cell[] = []
  for (let r = start[1] - SEARCH; r <= start[1] + SEARCH; r++) {
    for (let c = start[0] - SEARCH; c <= start[0] + SEARCH; c++) near.push([c, r])
  }
  near.sort((a, b) => distance(a, centre) - distance(b, centre))
  const found = near.find((cell) => !taken(cellKey(cell)) && hasRoom(cell, room, taken))
  if (found === undefined) throw new Error(`No room near ${start.join(',')}`)
  return found
}

/** Whether `count` cells can be reached from `start` without crossing a taken one. */
function hasRoom(start: Cell, count: number, taken: (key: string) => boolean): boolean {
  const seen = new Set([cellKey(start)])
  const queue = [start]
  for (let i = 0; i < queue.length && seen.size < count; i++) {
    for (const next of neighbours(queue[i])) {
      if (taken(cellKey(next)) || seen.has(cellKey(next))) continue
      seen.add(cellKey(next))
      queue.push(next)
    }
  }
  return seen.size >= count
}

for (const circle of ordered) {
  // A cell is taken if a state owns it or another state reserved it.
  const taken = (key: string) => owner.has(key) || (reserved.has(key) && reserved.get(key) !== circle.postal)
  // The seed: the reserved cell, or the closest free one if it has no room left.
  const start = seeds.get(circle.postal) ?? nearestFree([0, 0], circle.at, taken)
  const seed = hasRoom(start, circle.seats, taken) ? start : nearestFree(start, circle.at, taken, circle.seats)

  const own: Cell[] = [seed]
  const ownKeys = new Set([cellKey(seed)])
  owner.set(cellKey(seed), circle.postal)
  while (own.length < circle.seats) {
    // The free cell next to the state closest to its centre, preferring one
    // that touches more of the state (to keep it round) or of its neighbours
    // (to leave no holes between them). It never runs out: the seed had room.
    let best: { cell: Cell; score: number } | undefined
    for (const cell of own) {
      for (const next of neighbours(cell)) {
        if (taken(cellKey(next))) continue
        const around = neighbours(next).map(cellKey)
        const touchingOwn = around.filter((key) => ownKeys.has(key)).length
        const touchingOthers = around.filter((key) => owner.has(key) && !ownKeys.has(key)).length
        const score =
          distance(next, circle.at) / Math.max(circle.radius, 1) - TOUCH_OWN * touchingOwn - TOUCH_OTHERS * touchingOthers
        if (best === undefined || score < best.score) best = { cell: next, score }
      }
    }
    if (best === undefined) throw new Error(`${circle.postal} is boxed in`)
    own.push(best.cell)
    ownKeys.add(cellKey(best.cell))
    owner.set(cellKey(best.cell), circle.postal)
  }
  cells.set(circle.postal, own)
}

// 4. The holes: free cells boxed in by states, which would read as missing
// districts. A neighbouring state takes the hole and frees one of its cells
// closer to the outside, keeping itself in one piece, so the hole moves out
// step by step until it leaves the map.
function inOnePiece(own: readonly Cell[]): boolean {
  const keys = new Set(own.map(cellKey))
  const seen = new Set([cellKey(own[0])])
  const queue = [own[0]]
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbours(queue[i])) {
      if (keys.has(cellKey(next)) && !seen.has(cellKey(next))) {
        seen.add(cellKey(next))
        queue.push(next)
      }
    }
  }
  return seen.size === own.length
}

/** Every cell's distance to the outside (0 for a free cell that can reach the map's edge). */
function distancesOut(): Map<string, number> {
  const all = [...owner.keys()].map((key) => key.split(',').map(Number))
  const [minCol, maxCol] = [Math.min(...all.map(([c]) => c)) - 1, Math.max(...all.map(([c]) => c)) + 1]
  const [minRow, maxRow] = [Math.min(...all.map(([, r]) => r)) - 1, Math.max(...all.map(([, r]) => r)) + 1]
  const inside = ([c, r]: Cell) => c >= minCol && c <= maxCol && r >= minRow && r <= maxRow
  const out = new Map<string, number>([[cellKey([minCol, minRow]), 0]])
  // First the free cells reachable from the corner, then everything by steps.
  let queue: Cell[] = [[minCol, minRow]]
  for (let i = 0; i < queue.length; i++) {
    for (const next of neighbours(queue[i])) {
      if (!inside(next) || owner.has(cellKey(next)) || out.has(cellKey(next))) continue
      out.set(cellKey(next), 0)
      queue.push(next)
    }
  }
  for (let step = 1; queue.length > 0; step++) {
    const ring: Cell[] = []
    for (const cell of queue) {
      for (const next of neighbours(cell)) {
        if (!inside(next) || out.has(cellKey(next))) continue
        out.set(cellKey(next), step)
        ring.push(next)
      }
    }
    queue = ring
  }
  return out
}

for (let moves = 0; ; moves++) {
  if (moves > 1000) throw new Error('The holes would not move out')
  const out = distancesOut()
  const hole = [...out].find(([key, d]) => d > 0 && !owner.has(key))
  if (hole === undefined) break
  const [holeKey, holeOut] = hole
  const [holeCol, holeRow] = holeKey.split(',').map(Number)
  const holeCell: Cell = [holeCol, holeRow]
  // The neighbours' cells closer to the outside that each could give up.
  let best: { postal: string; give: Cell; out: number; far: number } | undefined
  for (const postal of new Set(neighbours(holeCell).flatMap((next) => owner.get(cellKey(next)) ?? []))) {
    const own = cells.get(postal) ?? []
    const circle = circles.find((c) => c.postal === postal)
    for (const give of own) {
      const giveOut = out.get(cellKey(give)) ?? Infinity
      if (giveOut >= holeOut) continue
      const after = [...own.filter((cell) => cell !== give), holeCell]
      if (!inOnePiece(after)) continue
      // Closest to the outside first, then the farthest from the state's centre.
      const far = circle === undefined ? 0 : distance(give, circle.at)
      if (best === undefined || giveOut < best.out || (giveOut === best.out && far > best.far)) {
        best = { postal, give, out: giveOut, far }
      }
    }
  }
  if (best === undefined) throw new Error(`The hole at ${holeKey} cannot move out`)
  const { postal, give } = best
  cells.set(postal, [...(cells.get(postal) ?? []).filter((cell) => cell !== give), holeCell])
  owner.delete(cellKey(give))
  owner.set(holeKey, postal)
}

// 5. Number the districts and move the grid to start at [0, 0], keeping the
// rows' parity (an odd row is the shifted one).
const all = [...cells.values()].flat()
const minCol = Math.min(...all.map(([col]) => col))
let minRow = Math.min(...all.map(([, row]) => row))
minRow -= minRow & 1

const layout: Record<string, Cell> = {}
for (const [postal, own] of [...cells].sort(([a], [b]) => a.localeCompare(b))) {
  const ordered = [...own].sort(([ac, ar], [bc, br]) => ar - br || ac - bc)
  const ids = districts.get(postal) ?? []
  ordered.forEach(([col, row], i) => {
    layout[ids[i]] = [col - minCol, row - minRow]
  })
}

// One district per line, so a change reads well in a diff.
const lines = Object.entries(layout).map(([id, [col, row]]) => `  "${id}": [${col}, ${row}]`)
writeFileSync(OUT, `{\n${lines.join(',\n')}\n}\n`)
console.log(`Wrote ${lines.length} hexagons for ${cells.size} states to ${OUT.pathname}`)
