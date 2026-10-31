import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import { HOUSE_MAJORITY, SENATE_R_CONTROL } from './config.ts'
import { closestRaces, flipsByLoser, tippingPoint } from './lists.ts'
import { deltaFrom, outcomeAt, type Outcome } from './margin.ts'
import { seatTotals, type SeatTotals } from './seats.ts'
import { candidate, makeRace } from './testRaces.ts'
import type { Dataset, Party } from './types.ts'

const dataset = raw as unknown as Dataset

function outcome(margin: number, winner: Party = margin > 0 ? 'R' : 'D'): Outcome {
  return { margin, winner }
}

describe('flipsByLoser', () => {
  it('sorts the flips by the party that loses them, the clearest first', () => {
    const races = [
      makeRace({ id: 'A', holder: 'R' }),
      makeRace({ id: 'B', holder: 'R' }),
      makeRace({ id: 'C', holder: 'D' }),
      makeRace({ id: 'D', holder: 'R' }),
    ]
    const outcomes = [outcome(-0.02), outcome(-0.08), outcome(0.03), outcome(0.05)]
    expect(flipsByLoser(races, outcomes)).toEqual({ R: [1, 0], D: [2], I: [] })
  })

  it("puts an independent's gain in the column of the party that held the seat", () => {
    const races = [makeRace({ holder: 'R', opp: candidate('I') })]
    expect(flipsByLoser(races, [outcome(-0.01, 'I')]).R).toEqual([0])
  })

  it('counts a fixed race in a seat the other party held, at the top', () => {
    const races = [makeRace({ holder: 'R' }), makeRace({ holder: 'R', type: 'DvD', fixedWinner: 'D' })]
    expect(flipsByLoser(races, [outcome(-0.2), outcome(-1)]).R).toEqual([1, 0])
  })
})

describe('closestRaces', () => {
  it('takes the smallest margins on either side and leaves fixed races out', () => {
    const races = [makeRace(), makeRace(), makeRace({ fixedWinner: 'R' }), makeRace(), makeRace()]
    const outcomes = [outcome(0.05), outcome(-0.01), outcome(1), outcome(0.02), outcome(-0.3)]
    expect(closestRaces(races, outcomes, 3)).toEqual([1, 3, 0])
  })
})

describe('tippingPoint', () => {
  it('is the race that brings R to control, counting the seats not up', () => {
    const races = Array.from({ length: 5 }, () => makeRace())
    const outcomes = [0.1, -0.2, 0.03, -0.01, 0.3].map((m) => outcome(m))
    // Sorted from the most R: 4, 0, 2, 3, 1. R needs 3 of the 5 races.
    expect(tippingPoint(races, outcomes, 3)).toBe(2)
    // With 2 seats not up, R needs only 1.
    expect(tippingPoint(races, outcomes, 3, 2)).toBe(4)
  })

  it('is undefined when the races cannot decide control', () => {
    const races = [makeRace(), makeRace()]
    expect(tippingPoint(races, [outcome(0.1), outcome(-0.1)], 3)).toBeUndefined()
    expect(tippingPoint(races, [outcome(0.1), outcome(-0.1)], 2, 2)).toBeUndefined()
  })

  // On the real races, across the slider: whoever wins the tipping-point race
  // has control at the deterministic count. An independent ahead in the REP
  // slot sorts with R without being an R seat, so those environments are
  // skipped (§4.7: the tipping point is then only approximate).
  for (const chamber of ['house', 'senate'] as const) {
    it(`decides control of the ${chamber} on the real races`, () => {
      const races = dataset.races.filter((race) => race.chamber === chamber)
      const notUp: Partial<SeatTotals> = chamber === 'senate' ? dataset.senateNotUp : {}
      const rControl = chamber === 'house' ? HOUSE_MAJORITY : SENATE_R_CONTROL
      let checked = 0
      for (let env = -0.29; env <= 0.2; env += 0.0025) {
        const outcomes = races.map((race) => outcomeAt(race, deltaFrom(env, dataset.g0)))
        const k = tippingPoint(races, outcomes, rControl, notUp.R)
        expect(k).toBeDefined()
        if (k === undefined) continue
        if (outcomes.some((o, j) => o.winner === 'I' && races[j].rep?.party === 'I')) continue
        expect(seatTotals(outcomes, notUp).R >= rControl, `env ${env}`).toBe(outcomes[k].margin > 0)
        checked += 1
      }
      expect(checked).toBeGreaterThan(100)
    })
  }
})
