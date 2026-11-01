import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import { SIGMA_NAT, SIGMA_RACE_HOUSE, SIGMA_RACE_SENATE, SIGMA_RACE_SENATE_NOPOLL } from './config.ts'
import { createSimulator, fillNormal, mulberry32, raceSigma, simulate, type SeatDistribution } from './simulate.ts'
import { candidate, makeRace } from './testRaces.ts'
import type { Dataset } from './types.ts'

function mean(values: Float32Array): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sd(values: Float32Array): number {
  const m = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length)
}

/** The average seat count of a distribution. */
function meanSeats(distribution: SeatDistribution): number {
  let sum = 0
  let n = 0
  distribution.histogram.forEach((count, seats) => {
    sum += count * seats
    n += count
  })
  return sum / n
}

describe('mulberry32', () => {
  it('repeats its sequence for the same seed', () => {
    const a = mulberry32(2026)
    const b = mulberry32(2026)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('stays in [0, 1)', () => {
    const random = mulberry32(1)
    for (let i = 0; i < 100_000; i++) {
      const value = random()
      expect(value >= 0 && value < 1).toBe(true)
    }
  })
})

describe('fillNormal', () => {
  it('draws Normal(0, sigma)', () => {
    const values = new Float32Array(100_001)
    fillNormal(values, 2, mulberry32(7))
    expect(Math.abs(mean(values))).toBeLessThan(0.03)
    expect(sd(values)).toBeCloseTo(2, 1)
  })
})

describe('raceSigma', () => {
  it('uses the House sigma for every House race', () => {
    expect(raceSigma(makeRace())).toBe(SIGMA_RACE_HOUSE)
  })

  it('widens the error of a Senate race with few polls or none', () => {
    const senate = (pollSource?: string) => makeRace({ chamber: 'senate', pollSource })
    expect(raceSigma(senate('Avg'))).toBe(SIGMA_RACE_SENATE)
    expect(raceSigma(senate('CtM'))).toBe(SIGMA_RACE_SENATE)
    expect(raceSigma(senate('Few'))).toBe(SIGMA_RACE_SENATE_NOPOLL)
    expect(raceSigma(senate())).toBe(SIGMA_RACE_SENATE_NOPOLL)
    expect(raceSigma(senate('Other'))).toBe(SIGMA_RACE_SENATE_NOPOLL)
  })

  it('knows the poll source of every real Senate race', () => {
    // A new label in the workbook would get the wider sigma without a word:
    // only the values in docs/SPEC.md §2.4 may appear.
    const senate = (raw as unknown as Dataset).races.filter((race) => race.chamber === 'senate')
    const known = ['Avg', 'CtM', 'Few']
    const unknown = senate.filter(({ pollSource }) => pollSource !== undefined && !known.includes(pollSource))
    expect(unknown.map(({ id, pollSource }) => `${id}: ${pollSource}`)).toEqual([])
  })
})

describe('createSimulator', () => {
  const races = [
    makeRace({ id: 'XX-01' }),
    makeRace({ id: 'YY-SEN', chamber: 'senate', pollSource: 'Avg' }),
    makeRace({ id: 'ZZ-SEN', chamber: 'senate', pollSource: 'Few' }),
  ]

  it('draws the same errors for the same seed, and others for another seed', () => {
    const a = createSimulator(races, 1000, 2026)
    expect(createSimulator(races, 1000, 2026)).toEqual(a)
    expect(createSimulator(races, 1000, 2027).national).not.toEqual(a.national)
  })

  it('scales the errors by the sigma of each race', () => {
    const n = 100_000
    const { national, raceErrors } = createSimulator(races, n)
    expect(sd(national)).toBeCloseTo(SIGMA_NAT, 3)
    expect(sd(raceErrors.subarray(0, n))).toBeCloseTo(SIGMA_RACE_HOUSE, 3)
    expect(sd(raceErrors.subarray(n, 2 * n))).toBeCloseTo(SIGMA_RACE_SENATE, 3)
    expect(sd(raceErrors.subarray(2 * n))).toBeCloseTo(SIGMA_RACE_SENATE_NOPOLL, 3)
  })
})

describe('simulate', () => {
  it('gives a race far ahead to its leader every time', () => {
    const race = makeRace({ m0: 0.5 })
    const forecast = simulate(createSimulator([race]), 'house', 0)
    expect(forecast.probabilities.get('XX-01')).toEqual({ R: 1, D: 0, I: 0 })
  })

  it('splits a tossup about evenly, and the slider moves it', () => {
    const simulator = createSimulator([makeRace({ m0: 0 })])
    expect(simulate(simulator, 'house', 0).probabilities.get('XX-01')?.R).toBeCloseTo(0.5, 1)
    expect(simulate(simulator, 'house', 0.1).probabilities.get('XX-01')?.R).toBeGreaterThan(0.9)
  })

  it('credits independents on either side', () => {
    const races = [
      makeRace({ id: 'A', m0: 0.3, rep: candidate('I') }),
      makeRace({ id: 'B', m0: -0.3, opp: candidate('I') }),
    ]
    const forecast = simulate(createSimulator(races), 'house', 0)
    expect(forecast.probabilities.get('A')?.I).toBe(1)
    expect(forecast.probabilities.get('B')?.I).toBe(1)
    expect(forecast.seats.I.median).toBe(2)
  })

  it("counts an independent who caucuses with R in R's bloc, not in R's seats", () => {
    const kiley = { ...candidate('I'), caucus: 'R' as const }
    const races = [makeRace({ id: 'A', m0: 0.5 }), makeRace({ id: 'B', m0: 0.5, rep: kiley })]
    const forecast = simulate(createSimulator(races), 'house', 0)
    expect(forecast.seats.R.median).toBe(1)
    expect(forecast.seats.I.median).toBe(1)
    expect(forecast.blocs.R.median).toBe(2)
    expect(forecast.blocs.D.median).toBe(0)
  })

  it('leaves an independent with no caucus out of both blocs', () => {
    const forecast = simulate(createSimulator([makeRace({ m0: 0.5, rep: candidate('I') })]), 'house', 0)
    expect(forecast.blocs.R.median).toBe(0)
    expect(forecast.blocs.D.median).toBe(0)
  })

  it('counts the Senate independents not up with the D bloc', () => {
    const races = [makeRace({ id: 'YY-SEN', chamber: 'senate', m0: 0.5 })]
    const forecast = simulate(createSimulator(races), 'senate', 0, { D: 3, I: 2, R: 2 })
    expect(forecast.blocs.D.median).toBe(5)
    expect(forecast.blocs.R.median).toBe(3)
  })

  it('counts fixed races for their winner in every simulation', () => {
    const race = makeRace({ type: 'RvR', m0: 1, fixedWinner: 'R', opp: candidate('R') })
    const forecast = simulate(createSimulator([race]), 'house', -0.3)
    expect(forecast.probabilities.get('XX-01')).toEqual({ R: 1, D: 0, I: 0 })
    expect(forecast.seats.R.histogram[1]).toBe(10_000)
  })

  it('runs Montana through the three-way rule', () => {
    const race = makeRace({
      id: 'MT-SEN',
      chamber: 'senate',
      type: 'MT3',
      m0: 0.13,
      opp: candidate('I'),
      shares: { A: 0.48, B: 0.35, C: 0.17, names: ['Alme', 'Bodnar', 'Bankhead'] },
    })
    const simulator = createSimulator([race])
    expect(simulate(simulator, 'senate', 0).probabilities.get('MT-SEN')?.R).toBeGreaterThan(0.9)
    expect(simulate(simulator, 'senate', -0.5).probabilities.get('MT-SEN')?.I).toBe(1)
  })

  it('only simulates the chamber asked for, and adds the seats not up', () => {
    const races = [makeRace({ id: 'XX-01', m0: -0.5 }), makeRace({ id: 'YY-SEN', chamber: 'senate', m0: 0.5 })]
    const forecast = simulate(createSimulator(races), 'senate', 0, { D: 3, R: 2 })
    expect([...forecast.probabilities.keys()]).toEqual(['YY-SEN'])
    expect(forecast.seats.R.median).toBe(3)
    expect(forecast.seats.D.median).toBe(3)
    expect(forecast.seats.R.histogram).toHaveLength(7)
  })

  it('correlates races through the national error', () => {
    // Two tossups with a shared error: both go R more often than 1 in 4.
    const races = [makeRace({ id: 'A' }), makeRace({ id: 'B' })]
    const forecast = simulate(createSimulator(races), 'house', 0)
    expect(forecast.seats.R.histogram[2] / 10_000).toBeGreaterThan(0.27)
  })

  it('makes every seat distribution consistent', () => {
    const races = Array.from({ length: 9 }, (_, i) => makeRace({ id: `XX-0${i}`, m0: (i - 4) * 0.03 }))
    const forecast = simulate(createSimulator(races), 'house', 0)
    const R = forecast.seats.R
    expect(R.histogram.reduce((sum, count) => sum + count, 0)).toBe(10_000)
    expect(R.interval80[0]).toBeLessThanOrEqual(R.median)
    expect(R.median).toBeLessThanOrEqual(R.interval80[1])
    const expected = [...forecast.probabilities.values()].reduce((sum, p) => sum + p.R, 0)
    expect(meanSeats(R)).toBeCloseTo(expected, 9)
  })
})
