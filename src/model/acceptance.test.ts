// Acceptance tests from docs/SPEC.md §5, against the real public/races.json.
// The expected values come from the workbook's own totals in the file, so
// these tests keep working when the forecast is updated.

import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import { ENV_MAX, ENV_MIN, MARGIN_CAP } from './config.ts'
import { outcomeAt } from './margin.ts'
import { ratingOf, type Rating } from './ratings.ts'
import { seatTotals } from './seats.ts'
import type { Dataset, RatingBucketName } from './types.ts'

const dataset = raw as unknown as Dataset
const house = dataset.races.filter((race) => race.chamber === 'house')
const senate = dataset.races.filter((race) => race.chamber === 'senate')
const twoCandidate = dataset.races.filter((race) => race.type === 'normal' || race.type === 'blend')

const BUCKET_NAMES: Record<Rating['bucket'], RatingBucketName> = {
  tilt: 'Tossup',
  lean: 'Lean',
  likely: 'Likely',
  safe: 'Safe',
}

/** A rating as the workbook writes it. The workbook only knows R and D: an
 * independent ahead on the opposition side shows as D. */
function workbookName(rating: Rating, margin: number): string {
  const side = margin >= 0 ? 'R' : 'D'
  return rating.bucket === 'tilt' ? `Tossup (Tilt ${side})` : `${BUCKET_NAMES[rating.bucket]} ${side}`
}

describe('the dataset', () => {
  it('has every House and Senate race', () => {
    expect(house).toHaveLength(435)
    expect(senate).toHaveLength(35)
  })
})

describe('at the baseline (slider = g0)', () => {
  const outcomes = dataset.races.map((race) => outcomeAt(race, 0))

  it('gives every race its baseline margin', () => {
    dataset.races.forEach((race, i) => {
      // Montana's margin is rebuilt from its three shares: equal up to rounding.
      if (race.type === 'MT3') expect(outcomes[i].margin, race.id).toBeCloseTo(race.m0, 12)
      else expect(outcomes[i].margin, race.id).toBe(race.m0)
    })
  })

  it('rates every race as the workbook does', () => {
    dataset.races.forEach((race, i) => {
      expect(workbookName(ratingOf(outcomes[i]), outcomes[i].margin), race.id).toBe(race.workbookRating)
    })
  })

  it('matches the workbook House seat totals', () => {
    const totals = seatTotals(house.map((race) => outcomeAt(race, 0)))
    expect(totals).toEqual({ ...dataset.workbook.house.seats, I: 0 })
  })

  it('matches the workbook House rating counts', () => {
    const counts: Record<string, { D: number; R: number }> = {}
    for (const race of house) {
      const outcome = outcomeAt(race, 0)
      const name = BUCKET_NAMES[ratingOf(outcome).bucket]
      counts[name] ??= { D: 0, R: 0 }
      counts[name][outcome.margin >= 0 ? 'R' : 'D'] += 1
    }
    expect(counts).toEqual(dataset.workbook.house.ratings)
  })

  it('matches the workbook Senate totals, seats not up included', () => {
    const totals = seatTotals(
      senate.map((race) => outcomeAt(race, 0)),
      dataset.senateNotUp,
    )
    expect(totals).toEqual(dataset.workbook.senate.seats)
  })

  it('gives Montana Alme − Bodnar = AE25', () => {
    const montana = senate.find((race) => race.type === 'MT3')
    expect(montana).toBeDefined()
    if (montana?.shares === undefined) return
    const { A, B } = montana.shares
    expect(A - B).toBeCloseTo(montana.m0, 9)
  })
})

describe('moving the slider', () => {
  it('moves every normal House race exactly one point per point', () => {
    for (const race of house.filter((r) => r.type === 'normal' && Math.abs(r.m0) < MARGIN_CAP - 0.01)) {
      expect(outcomeAt(race, 0.01).margin - race.m0, race.id).toBeCloseTo(0.01, 12)
    }
  })

  it('moves every blend race by its slope', () => {
    for (const race of house.filter((r) => r.type === 'blend')) {
      expect(outcomeAt(race, 0.01).margin - race.m0, race.id).toBeCloseTo(0.01 * race.slope, 12)
    }
  })

  it('never moves a fixed race', () => {
    for (const race of dataset.races.filter((r) => r.fixedWinner !== undefined)) {
      expect(outcomeAt(race, ENV_MAX - dataset.g0), race.id).toEqual(outcomeAt(race, 0))
      expect(outcomeAt(race, ENV_MIN - dataset.g0), race.id).toEqual(outcomeAt(race, 0))
    }
  })

  it('never shows a loser below 5% across the whole slider range', () => {
    for (let env = ENV_MIN; env <= ENV_MAX + 1e-9; env += 0.0025) {
      for (const race of twoCandidate) {
        const { margin } = outcomeAt(race, env - dataset.g0)
        const loserShare = (1 - Math.abs(margin)) / 2
        if (Math.abs(race.m0) <= MARGIN_CAP) expect(loserShare, `${race.id} at ${env}`).toBeGreaterThanOrEqual(0.05 - 1e-12)
      }
    }
  })
})
