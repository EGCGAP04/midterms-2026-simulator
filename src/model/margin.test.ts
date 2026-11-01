import { describe, expect, it } from 'vitest'
import { deltaFrom, mt3Shares, outcomeAt } from './margin.ts'
import { candidate, makeRace } from './testRaces.ts'

describe('outcomeAt: normal and blend races', () => {
  it('returns the baseline margin at Δ = 0', () => {
    expect(outcomeAt(makeRace({ m0: -0.035 }), 0)).toEqual({ margin: -0.035, winner: 'D' })
  })

  it('moves a normal race one-for-one with the slider', () => {
    expect(outcomeAt(makeRace({ m0: -0.035 }), 0.01).margin).toBeCloseTo(-0.025, 12)
  })

  it('moves a blend race by its slope', () => {
    expect(outcomeAt(makeRace({ type: 'blend', m0: 0.02, slope: 0.6 }), -0.05).margin).toBeCloseTo(-0.01, 12)
  })

  it('gives an exact tie to the REP slot (Tilt R)', () => {
    expect(outcomeAt(makeRace({ m0: -0.01 }), 0.01).winner).toBe('R')
  })

  it('caps the margin at ±0.90, keeping the loser at 5% or more', () => {
    expect(outcomeAt(makeRace({ m0: 0.85 }), 0.2).margin).toBe(0.9)
    expect(outcomeAt(makeRace({ m0: -0.85 }), -0.2).margin).toBe(-0.9)
  })

  it('never pushes a race that starts beyond the cap further out', () => {
    const race = makeRace({ m0: -0.95 })
    expect(outcomeAt(race, -0.1).margin).toBe(-0.95)
    expect(outcomeAt(race, 0.1).margin).toBeCloseTo(-0.85, 12)
  })

  it('credits an independent in the REP slot when it leads', () => {
    const race = makeRace({ m0: -0.2, rep: candidate('I') })
    expect(outcomeAt(race, 0).winner).toBe('D')
    expect(outcomeAt(race, 0.25).winner).toBe('I')
  })

  it('credits an independent on the opposition side when it leads', () => {
    expect(outcomeAt(makeRace({ m0: 0.01, opp: candidate('I') }), -0.02).winner).toBe('I')
  })
})

describe('outcomeAt: fixed races', () => {
  it.each([
    ['uncontested', 'D', -1],
    ['DvD', 'D', -1],
    ['RvR', 'R', 1],
  ] as const)('%s races ignore the slider', (type, winner, m0) => {
    const race = makeRace({ type, m0, fixedWinner: winner, rep: type === 'uncontested' ? null : candidate(winner) })
    for (const delta of [-0.3, 0, 0.3]) expect(outcomeAt(race, delta)).toEqual({ margin: m0, winner })
  })
})

describe('Montana (MT3)', () => {
  const shares = { A: 0.48, B: 0.35, C: 0.17 }
  const race = makeRace({
    type: 'MT3',
    chamber: 'senate',
    m0: 0.13,
    opp: candidate('I'),
    shares: { ...shares, names: ['Alme', 'Bodnar', 'Bankhead'], thirdLabel: 'nonIncumbent' },
  })

  it('keeps the baseline shares at Δ = 0', () => {
    const outcome = outcomeAt(race, 0)
    expect(outcome.margin).toBeCloseTo(0.13, 12)
    expect(outcome.winner).toBe('R')
  })

  it('moves A by Δ/2 and splits the rest between B and C in proportion', () => {
    const moved = mt3Shares(shares, -0.1)
    expect(moved.A).toBeCloseTo(0.43, 12)
    expect(moved.B / moved.C).toBeCloseTo(0.35 / 0.17, 12)
    expect(moved.A + moved.B + moved.C).toBeCloseTo(1, 12)
  })

  it('clamps A to [0.05, 0.95] and still adds up to 1', () => {
    for (const delta of [-2, 2]) {
      const moved = mt3Shares(shares, delta)
      expect(moved.A).toBe(delta < 0 ? 0.05 : 0.95)
      expect(moved.A + moved.B + moved.C).toBeCloseTo(1, 12)
    }
  })

  it('gives the race to the independent when it leads', () => {
    const outcome = outcomeAt(race, -0.2)
    expect(outcome.winner).toBe('I')
    expect(outcome.margin).toBeLessThan(0)
  })
})

describe('deltaFrom', () => {
  it('measures the slider against the workbook baseline', () => {
    expect(deltaFrom(-0.0875, -0.09)).toBeCloseTo(0.0025, 12)
  })
})
