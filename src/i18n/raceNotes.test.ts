import { describe, expect, it } from 'vitest'
import { candidate, makeRace } from '../model/testRaces.ts'
import { raceNotes } from './raceNotes.ts'

describe('raceNotes', () => {
  it('has nothing to say about a normal race', () => {
    expect(raceNotes('en', makeRace())).toEqual([])
  })

  it('gives a blend its slope as a percentage', () => {
    expect(raceNotes('en', makeRace({ type: 'blend', state: 'CA', slope: 0.563 }))).toEqual([
      'Top-two primary blend: it moves 56% as much as the national environment.',
    ])
  })

  it("calls Alaska's primary top-four", () => {
    expect(raceNotes('en', makeRace({ type: 'blend', state: 'AK', slope: 0.664 }))[0]).toMatch(/^Top-four/)
  })

  it('explains fixed races', () => {
    expect(raceNotes('en', makeRace({ type: 'uncontested', rep: null, fixedWinner: 'D' }))).toEqual([
      'Uncontested: only one candidate is running.',
    ])
    expect(raceNotes('es', makeRace({ type: 'DvD', rep: candidate('D'), fixedWinner: 'D' }))).toEqual([
      'Dos demócratas: el escaño queda para los D, sea cual sea el entorno.',
    ])
  })

  it('adds an independent to the race type', () => {
    const notes = raceNotes('en', makeRace({ type: 'blend', state: 'CA', slope: 0.588, rep: candidate('I') }))
    expect(notes).toHaveLength(2)
    expect(notes[1]).toMatch(/^No Republican is running/)
    expect(raceNotes('en', makeRace({ opp: candidate('I') }))).toEqual([
      'No Democrat is running: the independent takes the Democratic side, so a shift toward D helps them.',
    ])
  })

  it('says when an independent caucuses with a party', () => {
    const kiley = { ...candidate('I', 'Kevin Kiley'), caucus: 'R' as const }
    const notes = raceNotes('es', makeRace({ rep: kiley }))
    expect(notes).toHaveLength(2)
    expect(notes[1]).toBe('Kevin Kiley forma parte de la bancada republicana: si gana, el escaño cuenta para la mayoría de los R.')
  })

  it("names Montana's three candidates, without an independent note", () => {
    const race = makeRace({
      type: 'MT3',
      opp: candidate('I'),
      shares: { A: 0.48, B: 0.35, C: 0.17, names: ['Kurt Alme', 'Seth Bodnar', 'Alani Bankhead'] },
    })
    expect(raceNotes('en', race)).toEqual([
      "Three-way race: Kurt Alme's share moves by half the environment's shift, and Seth Bodnar and Alani Bankhead split the rest in proportion.",
    ])
  })
})
