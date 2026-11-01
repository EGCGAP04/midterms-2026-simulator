import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import { adjustmentOrder, adjustRaces, clampShift, isAdjustmentKey, raceShift, shiftRace } from './adjust.ts'
import { outcomeAt } from './margin.ts'
import { createSimulator, simulate } from './simulate.ts'
import { candidate, makeRace } from './testRaces.ts'
import type { Dataset } from './types.ts'

describe('keys and values', () => {
  it.each(['TX', 'TX-09', 'AK-AL'])('accepts %s', (key) => expect(isAdjustmentKey(key)).toBe(true))
  it.each(['tx', 'TX-9', 'TX-SEN', 'TEX', 'TX-091'])('rejects %s', (key) => expect(isAdjustmentKey(key)).toBe(false))

  it('rounds to 0.1 points and keeps within ±20', () => {
    expect(clampShift(0.01234)).toBe(0.012)
    expect(clampShift(0.25)).toBe(0.2)
    expect(clampShift(-0.3)).toBe(-0.2)
  })

  it('orders states first, then districts', () => {
    expect(['TX-09', 'CA', 'AK-AL', 'AZ'].sort(adjustmentOrder)).toEqual(['AZ', 'CA', 'AK-AL', 'TX-09'])
  })
})

describe('raceShift', () => {
  const adjustments = new Map([
    ['TX', 0.02],
    ['TX-09', -0.05],
    ['TX-SEN', 0.5],
  ])

  it('adds a district’s own shift to its state’s', () => {
    expect(raceShift(makeRace({ id: 'TX-09', state: 'TX' }), adjustments)).toBeCloseTo(-0.03, 12)
    expect(raceShift(makeRace({ id: 'TX-10', state: 'TX' }), adjustments)).toBe(0.02)
  })

  it('gives a Senate race its state’s shift only', () => {
    expect(raceShift(makeRace({ id: 'TX-SEN', chamber: 'senate', state: 'TX' }), adjustments)).toBe(0.02)
    expect(raceShift(makeRace({ id: 'NM-SEN', chamber: 'senate', state: 'NM' }), adjustments)).toBe(0)
  })
})

describe('shiftRace', () => {
  it('moves the baseline, not scaled by the slope', () => {
    const race = makeRace({ type: 'blend', m0: 0.01, slope: 0.5 })
    const shifted = shiftRace(race, -0.04)
    expect(shifted.m0).toBeCloseTo(-0.03, 12)
    expect(outcomeAt(shifted, 0.02).margin).toBeCloseTo(outcomeAt(race, 0.02).margin - 0.04, 12)
  })

  it('leaves a fixed race alone', () => {
    const race = makeRace({ type: 'RvR', m0: 1, fixedWinner: 'R', opp: candidate('R') })
    expect(shiftRace(race, -0.2)).toBe(race)
  })

  it('moves Montana’s shares as a local environment', () => {
    const shares = { A: 0.48, B: 0.35, C: 0.17, names: ['Alme', 'Bodnar', 'Bankhead'] as [string, string, string], thirdLabel: 'nonIncumbent' as const }
    const race = makeRace({ id: 'MT-SEN', chamber: 'senate', type: 'MT3', m0: 0.13, opp: candidate('I'), shares })
    const shifted = shiftRace(race, -0.1)
    expect(shifted.shares?.A).toBeCloseTo(0.43, 12)
    expect(shifted.shares?.names).toEqual(shares.names)
    expect(shifted.shares?.thirdLabel).toBe('nonIncumbent')
    expect(outcomeAt(shifted, 0).shares?.A).toBeCloseTo(outcomeAt(race, -0.1).shares?.A ?? NaN, 12)
  })
})

describe('adjustRaces', () => {
  const dataset = raw as unknown as Dataset

  it('returns the same races without a shift that is not zero', () => {
    expect(adjustRaces(dataset.races, new Map())).toBe(dataset.races)
    expect(adjustRaces(dataset.races, new Map([['TX', 0]]))).toBe(dataset.races)
  })

  it('moves the simulation with the shift, keeping the drawn errors', () => {
    const simulator = createSimulator(dataset.races, 2000)
    const at = (shift: number) => {
      const races = adjustRaces(dataset.races, new Map([['TX', shift]]))
      return simulate({ ...simulator, races }, 'senate', 0, dataset.senateNotUp).probabilities.get('TX-SEN')?.R ?? NaN
    }
    expect(at(-0.1)).toBeLessThan(at(0))
    expect(at(0)).toBeLessThan(at(0.1))
    expect(at(0)).toBe(simulate(simulator, 'senate', 0, dataset.senateNotUp).probabilities.get('TX-SEN')?.R)
  })
})
