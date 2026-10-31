import { describe, expect, it } from 'vitest'
import { seatBars, seatTicks } from './histogram.ts'

describe('seatBars', () => {
  it('leaves out the empty counts at both ends', () => {
    const histogram = Uint32Array.from([0, 0, 1, 0, 3, 0])
    expect(seatBars(histogram)).toEqual({ lo: 2, hi: 4, shares: [0.25, 0, 0.75] })
  })

  it('is undefined for an empty histogram', () => {
    expect(seatBars(new Uint32Array(5))).toBeUndefined()
  })
})

describe('seatTicks', () => {
  it('picks the smallest round step that gives at most 8 ticks', () => {
    expect(seatTicks(44, 52)).toEqual([44, 46, 48, 50, 52])
    expect(seatTicks(171, 243)).toEqual([180, 190, 200, 210, 220, 230, 240])
    expect(seatTicks(3, 5)).toEqual([3, 4, 5])
  })

  it('marks a single count', () => {
    expect(seatTicks(217, 217)).toEqual([217])
  })
})
