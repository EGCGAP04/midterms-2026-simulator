// The House map's hexagon grid (docs/SPEC.md §4.4): pointy-top hexagons in
// rows, every odd row shifted half a hexagon to the right. A cell is
// [column, row]; positions are in hexagon widths.

export type Cell = readonly [col: number, row: number]

/** The distance between two rows' centres. */
export const ROW_HEIGHT = Math.sqrt(3) / 2

/** A hexagon's height, corner to corner. */
export const HEX_HEIGHT = 2 / Math.sqrt(3)

/** A cell's centre. */
export function cellCentre([col, row]: Cell): [number, number] {
  return [col + (row & 1) / 2, row * ROW_HEIGHT]
}

// The six neighbours, clockwise from the right, for even and odd rows.
const EVEN_ROW: readonly Cell[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]]
const ODD_ROW: readonly Cell[] = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]

/** The six cells around a cell, clockwise from the right. */
export function neighbours([col, row]: Cell): Cell[] {
  return (row & 1 ? ODD_ROW : EVEN_ROW).map(([dc, dr]) => [col + dc, row + dr] as const)
}

/** The six corners around a centre, clockwise from the top-right one: corner
 * `i` and `i + 1` bound the side shared with `neighbours(cell)[i]`. */
export function hexCorners([x, y]: readonly [number, number]): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * (i - 0.5)
    return [x + (HEX_HEIGHT / 2) * Math.cos(angle), y + (HEX_HEIGHT / 2) * Math.sin(angle)]
  })
}

/** A key for cells in maps and sets. */
export function cellKey([col, row]: Cell): string {
  return `${col},${row}`
}
