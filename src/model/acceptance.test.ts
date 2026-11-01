// Acceptance tests from docs/SPEC.md §5, against the real public/races.json.
// The expected values come from the workbook's own totals in the file, so
// these tests keep working when the forecast is updated.

import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN, MARGIN_CAP } from './config.ts'
import { outcomeAt } from './margin.ts'
import { ratingOf, type Rating } from './ratings.ts'
import { seatTotals, type SeatTotals } from './seats.ts'
import { createSimulator, simulate, type ChamberForecast } from './simulate.ts'
import { blockMembers, summaryBlocks } from './summary.ts'
import type { Chamber, Dataset, RatingBucketName } from './types.ts'

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
    const notUp = dataset.senateNotUp
    const totals = seatTotals(
      senate.map((race) => outcomeAt(race, 0)),
      notUp,
    )
    // The workbook counts the independents not up (Sanders, King) as D.
    expect({ D: totals.D + notUp.I, I: totals.I - notUp.I, R: totals.R }).toEqual(dataset.workbook.senate.seats)
  })

  it('fills the Senate with the seats not up', () => {
    const { D, I, R } = dataset.senateNotUp
    expect(D + I + R + senate.length).toBe(100)
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

describe('the summary bar', () => {
  it('adds up to every party’s seats across the whole slider range', () => {
    for (let env = ENV_MIN; env <= ENV_MAX + 1e-9; env += 0.005) {
      for (const [races, notUp] of [
        [house, {}],
        [senate, dataset.senateNotUp],
      ] as const) {
        const outcomes = races.map((race) => outcomeAt(race, env - dataset.g0))
        const blocks = summaryBlocks(races, outcomes, notUp)
        const seats: SeatTotals = { R: 0, D: 0, I: 0 }
        for (const block of blocks) seats[block.party] += block.seats
        expect(seats).toEqual(seatTotals(outcomes, notUp))
        // Each block lists as many members as it has seats.
        for (const block of blocks) {
          expect(blockMembers(block, races, outcomes, dataset.senatorsNotUp)).toHaveLength(block.seats)
        }
      }
    }
  })

  it('puts every independent on the side of the party it runs against', () => {
    for (const env of [ENV_MIN, DEFAULT_ENV, ENV_MAX]) {
      for (const races of [house, senate]) {
        const outcomes = races.map((race) => outcomeAt(race, env - dataset.g0))
        const expected = { D: 0, R: 0 }
        outcomes.forEach((outcome, k) => {
          if (outcome.winner === 'I') expected[races[k].rep?.party === 'I' ? 'R' : 'D'] += 1
        })
        const blocks = summaryBlocks(races, outcomes).filter((block) => block.party === 'I')
        expect(Object.fromEntries(blocks.map((block) => [block.side, block.seats]))).toEqual(expected)
      }
    }
  })
})

describe('the Monte Carlo', () => {
  const simulator = createSimulator(dataset.races)
  const notUp: Record<Chamber, Partial<SeatTotals>> = { house: {}, senate: dataset.senateNotUp }
  const forecastAt = (chamber: Chamber, env: number): ChamberForecast =>
    simulate(simulator, chamber, env - dataset.g0, notUp[chamber])

  it.each(['house', 'senate'] as const)('gives probabilities monotonic in the slider for every %s race', (chamber) => {
    const races = dataset.races.filter((race) => race.chamber === chamber && race.fixedWinner === undefined)
    let previous = forecastAt(chamber, ENV_MIN)
    for (let env = ENV_MIN + 0.005; env <= ENV_MAX + 1e-9; env += 0.005) {
      const forecast = forecastAt(chamber, env)
      for (const race of races) {
        // The REP slot's party (R, or I in AZ-03, CA-06, MA-01 and PA-03).
        const party = race.rep?.party ?? 'R'
        const before = previous.probabilities.get(race.id)?.[party] ?? NaN
        expect(forecast.probabilities.get(race.id)?.[party], `${race.id} at ${env}`).toBeGreaterThanOrEqual(before)
      }
      expect(forecast.control.R, `R control at ${env}`).toBeGreaterThanOrEqual(previous.control.R)
      previous = forecast
    }
  })

  it('gives every fixed race to its winner in every simulation', () => {
    for (const env of [ENV_MIN, ENV_MAX]) {
      for (const chamber of ['house', 'senate'] as const) {
        const forecast = forecastAt(chamber, env)
        for (const race of dataset.races.filter((r) => r.chamber === chamber && r.fixedWinner !== undefined)) {
          expect(forecast.probabilities.get(race.id)?.[race.fixedWinner ?? 'R'], race.id).toBe(1)
        }
      }
    }
  })

  it('favors the side ahead at the baseline in every race not within a point', () => {
    for (const chamber of ['house', 'senate'] as const) {
      const forecast = simulate(simulator, chamber, 0, notUp[chamber])
      for (const race of dataset.races.filter((r) => r.chamber === chamber)) {
        const outcome = outcomeAt(race, 0)
        if (Math.abs(outcome.margin) < 0.01) continue
        expect(forecast.probabilities.get(race.id)?.[outcome.winner], race.id).toBeGreaterThan(0.5)
      }
    }
  })

  it('adds the expected seats up to the per-race probabilities', () => {
    for (const chamber of ['house', 'senate'] as const) {
      const forecast = forecastAt(chamber, DEFAULT_ENV)
      for (const party of ['R', 'D', 'I'] as const) {
        const fromRaces =
          [...forecast.probabilities.values()].reduce((sum, p) => sum + p[party], 0) + (notUp[chamber][party] ?? 0)
        let seats = 0
        forecast.seats[party].histogram.forEach((count, s) => (seats += count * s))
        expect(seats / simulator.n, `${chamber} ${party}`).toBeCloseTo(fromRaces, 9)
      }
    }
  })

  it('reads the median and the 80% interval off the seat histogram', () => {
    const { median, interval80, histogram } = forecastAt('house', DEFAULT_ENV).seats.D
    // The smallest seat count reached by at least a share q of the simulations.
    const atLeast = (q: number): number => {
      let cumulative = 0
      return histogram.findIndex((count) => (cumulative += count) >= q * simulator.n)
    }
    expect([median, ...interval80]).toEqual([atLeast(0.5), atLeast(0.1), atLeast(0.9)])
    expect(interval80[0]).toBeLessThan(median)
    expect(median).toBeLessThan(interval80[1])
  })

  it('needs 218 House seats for a majority, and 50 Senate seats for R control', () => {
    const share = (histogram: Uint32Array, from: number): number =>
      histogram.slice(from).reduce((sum, count) => sum + count, 0) / simulator.n
    // Near even, so every threshold is crossed in some simulations. In the
    // House, control goes by bloc: Kiley (I) counts with R (§2.3).
    const house = forecastAt('house', 0)
    expect(house.control.R).toBe(share(house.blocs.R.histogram, 218))
    expect(house.control.opposition).toBe(share(house.blocs.D.histogram, 218))
    expect(house.control.R).toBeGreaterThanOrEqual(share(house.seats.R.histogram, 218))
    const senate = forecastAt('senate', 0.02)
    expect(senate.control.R).toBe(share(senate.seats.R.histogram, 50))
    expect(share(senate.seats.R.histogram, 50)).not.toBe(share(senate.seats.R.histogram, 51))
  })

  it('reports Senate control as R or D + I, and House control by majority', () => {
    const senateForecast = forecastAt('senate', DEFAULT_ENV)
    expect(senateForecast.control.R + senateForecast.control.opposition).toBe(1)
    const houseForecast = forecastAt('house', DEFAULT_ENV)
    expect(houseForecast.control.R + houseForecast.control.opposition).toBeLessThanOrEqual(1)
  })
})
