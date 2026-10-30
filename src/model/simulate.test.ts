import { describe, expect, it } from 'vitest'
import { createSimulator, fillNormal, mulberry32, simulate, type SeatDistribution } from './simulate.ts'
import { candidate, makeRace } from './testRaces.ts'

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

describe('createSimulator', () => {
  const races = [makeRace({ id: 'XX-01' }), makeRace({ id: 'YY-SEN', chamber: 'senate' })]

  it('draws the same errors for the same seed, and others for another seed', () => {
    const a = createSimulator(races, 1000, 2026)
    expect(createSimulator(races, 1000, 2026)).toEqual(a)
    expect(createSimulator(races, 1000, 2027).national).not.toEqual(a.national)
  })

  it('scales the errors by the chamber sigmas', () => {
    const { national, raceErrors } = createSimulator(races, 100_000)
    expect(sd(national)).toBeCloseTo(0.03, 3)
    expect(sd(raceErrors.subarray(0, 100_000))).toBeCloseTo(0.05, 3)
    expect(sd(raceErrors.subarray(100_000))).toBeCloseTo(0.045, 3)
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
