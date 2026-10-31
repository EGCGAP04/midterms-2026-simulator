import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import type { Dataset } from '../model/types.ts'
import { cellCentre, cellKey, hexCorners, neighbours, type Cell } from './hexGrid.ts'
import layout from './houseHexes.json'
import { houseLayout } from './houseLayout.ts'

const dataset = raw as unknown as Dataset
const cells = layout as unknown as Record<string, Cell>
const house = dataset.races.filter((race) => race.chamber === 'house')

describe('hexGrid', () => {
  it('finds each neighbour across the side between its two corners', () => {
    for (const cell of [[3, 4], [3, 5]] as Cell[]) {
      const corners = hexCorners(cellCentre(cell))
      neighbours(cell).forEach((next, i) => {
        // The side's middle is halfway between the two centres.
        const [ax, ay] = corners[i]
        const [bx, by] = corners[(i + 1) % 6]
        const [cx, cy] = cellCentre(cell)
        const [nx, ny] = cellCentre(next)
        expect((ax + bx) / 2).toBeCloseTo((cx + nx) / 2)
        expect((ay + by) / 2).toBeCloseTo((cy + ny) / 2)
      })
    }
  })

  it('makes neighbours mutual', () => {
    for (const cell of [[0, 0], [5, 1], [2, 6], [7, 7]] as Cell[]) {
      for (const next of neighbours(cell)) expect(neighbours(next).map(cellKey)).toContain(cellKey(cell))
    }
  })
})

describe('houseHexes.json', () => {
  it('has a hexagon for every House race, and none other', () => {
    expect(Object.keys(cells).sort()).toEqual(house.map((race) => race.id).sort())
  })

  it('puts each district in a cell of its own', () => {
    const keys = Object.values(cells).map(cellKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps every state in one piece', () => {
    const states = new Map<string, Cell[]>()
    for (const [id, cell] of Object.entries(cells)) states.set(id.slice(0, 2), [...(states.get(id.slice(0, 2)) ?? []), cell])
    for (const [postal, own] of states) {
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
      expect(seen.size, postal).toBe(own.length)
    }
  })

  it('leaves no holes between states', () => {
    // Every free cell around the districts can reach the edge of their box.
    const taken = new Set(Object.values(cells).map(cellKey))
    const cols = Object.values(cells).map(([col]) => col)
    const rows = Object.values(cells).map(([, row]) => row)
    const [minCol, maxCol, minRow, maxRow] = [Math.min(...cols) - 1, Math.max(...cols) + 1, Math.min(...rows) - 1, Math.max(...rows) + 1]
    const seen = new Set([cellKey([minCol, minRow])])
    const queue: Cell[] = [[minCol, minRow]]
    for (let i = 0; i < queue.length; i++) {
      for (const next of neighbours(queue[i])) {
        const [col, row] = next
        if (col < minCol || col > maxCol || row < minRow || row > maxRow) continue
        if (taken.has(cellKey(next)) || seen.has(cellKey(next))) continue
        seen.add(cellKey(next))
        queue.push(next)
      }
    }
    const boxed: string[] = []
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!taken.has(cellKey([col, row])) && !seen.has(cellKey([col, row]))) boxed.push(cellKey([col, row]))
      }
    }
    expect(boxed).toEqual([])
  })

  it('numbers each state in reading order', () => {
    const ids = Object.keys(cells).sort()
    for (let i = 1; i < ids.length; i++) {
      const [before, after] = [ids[i - 1], ids[i]]
      if (before.slice(0, 2) !== after.slice(0, 2)) continue
      const [[bc, br], [ac, ar]] = [cells[before], cells[after]]
      expect(ar > br || (ar === br && ac > bc), `${before} before ${after}`).toBe(true)
    }
  })
})

describe('houseLayout', () => {
  const { width, height, hexes, borders, labels } = houseLayout()

  it('draws every hexagon inside the map', () => {
    expect(hexes).toHaveLength(house.length)
    for (const { id, d, centre } of hexes) {
      expect(d, id).toMatch(/^M[\d.,L]+Z$/)
      expect(centre[0], id).toBeGreaterThan(0)
      expect(centre[0], id).toBeLessThan(width)
      expect(centre[1], id).toBeGreaterThan(0)
      expect(centre[1], id).toBeLessThan(height)
    }
  })

  it('labels every state once', () => {
    expect(labels.map((label) => label.postal).sort()).toEqual([...new Set(house.map((race) => race.state))].sort())
  })

  it('draws a border only between states', () => {
    // Two districts of XX side by side, and YY under both: 3 × 6 sides, less
    // the one inside XX, with the two between XX and YY drawn once.
    const small = houseLayout({ 'XX-01': [0, 0], 'XX-02': [1, 0], 'YY-01': [0, 1] })
    expect(small.borders.match(/M/g)).toHaveLength(18 - 2 - 2)
    expect(borders.length).toBeGreaterThan(0)
  })
})
