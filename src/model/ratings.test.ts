import { describe, expect, it } from 'vitest'
import { bucketOf, countRatings, ratingOf } from './ratings.ts'
import { seatTotals } from './seats.ts'

describe('bucketOf', () => {
  it.each([
    [0, 'tilt'],
    [0.0199, 'tilt'],
    [0.02, 'lean'],
    [-0.0599, 'lean'],
    [0.06, 'likely'],
    [-0.1199, 'likely'],
    [0.12, 'safe'],
    [-1, 'safe'],
  ] as const)('|%f| is %s', (margin, bucket) => {
    expect(bucketOf(margin)).toBe(bucket)
  })
})

describe('ratingOf and countRatings', () => {
  it('rates the side ahead, independents included', () => {
    expect(ratingOf({ margin: -0.03, winner: 'I' })).toEqual({ bucket: 'lean', party: 'I' })
  })

  it('counts by party and bucket', () => {
    const counts = countRatings([
      { bucket: 'safe', party: 'R' },
      { bucket: 'safe', party: 'R' },
      { bucket: 'tilt', party: 'D' },
    ])
    expect(counts.R.safe).toBe(2)
    expect(counts.D.tilt).toBe(1)
    expect(counts.I).toEqual({ tilt: 0, lean: 0, likely: 0, safe: 0 })
  })
})

describe('seatTotals', () => {
  it('adds the winners to the seats not up', () => {
    const outcomes = [
      { margin: 0.1, winner: 'R' },
      { margin: -0.1, winner: 'D' },
      { margin: -0.1, winner: 'I' },
    ] as const
    expect(seatTotals(outcomes, { D: 34, R: 31 })).toEqual({ R: 32, D: 35, I: 1 })
  })
})
