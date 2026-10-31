import { describe, expect, it } from 'vitest'
import { flipOf } from './flips.ts'
import { candidate, makeRace } from './testRaces.ts'

describe('flipOf', () => {
  it('is undefined while the holder stays ahead', () => {
    expect(flipOf(makeRace({ holder: 'R' }), { margin: 0.05, winner: 'R' })).toBeUndefined()
  })

  it('goes from the holder to the side ahead', () => {
    expect(flipOf(makeRace({ holder: 'R' }), { margin: -0.05, winner: 'D' })).toEqual({ from: 'R', to: 'D' })
  })

  it('counts an independent taking the seat', () => {
    const race = makeRace({ holder: 'R', opp: candidate('I') })
    expect(flipOf(race, { margin: -0.01, winner: 'I' })).toEqual({ from: 'R', to: 'I' })
  })
})
