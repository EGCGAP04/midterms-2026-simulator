import { describe, expect, it } from 'vitest'
import type { Outcome } from './margin.ts'
import { independentSide, summaryBlocks } from './summary.ts'
import { candidate, makeRace } from './testRaces.ts'
import type { Race } from './types.ts'

const race = makeRace()
const againstD = makeRace({ rep: candidate('I'), opp: candidate('D') })
const againstR = makeRace({ rep: candidate('R'), opp: candidate('I') })

/** `count` races of `race` won by `winner` at `margin`. */
const won = (count: number, winner: Outcome['winner'], margin: number, from = race): [Race, Outcome][] =>
  Array.from({ length: count }, () => [from, { winner, margin }])

const results = [
  ...won(5, 'D', -0.3),
  ...won(1, 'D', -0.01),
  ...won(1, 'I', -0.03, againstR),
  ...won(1, 'I', 0.2, againstR),
  ...won(1, 'I', 0.07, againstD),
  ...won(2, 'R', 0.08),
]
const races = results.map(([r]) => r)
const outcomes = results.map(([, outcome]) => outcome)

describe('independentSide', () => {
  it('puts an independent next to the party it runs against', () => {
    expect(independentSide(againstD)).toBe('R')
    expect(independentSide(againstR)).toBe('D')
  })
})

describe('summaryBlocks', () => {
  it('runs from Safe D to Safe R, with independents in the middle on their side', () => {
    const blocks = summaryBlocks(races, outcomes)
    expect(blocks.map((block) => `${block.kind} ${block.party} ${block.side} ${block.seats}`)).toEqual([
      'safe D D 5',
      'likely D D 0',
      'lean D D 0',
      'tilt D D 1',
      'independent I D 2',
      'independent I R 1',
      'tilt R R 0',
      'lean R R 0',
      'likely R R 2',
      'safe R R 0',
    ])
  })

  it('puts the seats not up at the two ends', () => {
    const blocks = summaryBlocks(races, outcomes, { D: 3, R: 4 })
    expect(blocks[0]).toMatchObject({ party: 'D', kind: 'notUp', seats: 3, start: 0 })
    expect(blocks[blocks.length - 1]).toMatchObject({ party: 'R', kind: 'notUp', seats: 4 })
  })

  it('puts the independents not up right after the D seats not up', () => {
    const blocks = summaryBlocks(races, outcomes, { D: 3, I: 2, R: 4 })
    expect(blocks[1]).toMatchObject({ party: 'I', side: 'D', kind: 'notUp', seats: 2 })
    expect(blocks[1].start).toBeCloseTo(3 / 20, 12)
  })

  it('places each block right after the one before, filling the bar', () => {
    const blocks = summaryBlocks(races, outcomes, { D: 3, R: 4 })
    expect(blocks.reduce((sum, block) => sum + block.seats, 0)).toBe(18)
    blocks.slice(1).forEach((block, i) => {
      expect(block.start).toBeCloseTo(blocks[i].start + blocks[i].share, 12)
    })
    const last = blocks[blocks.length - 1]
    expect(last.start + last.share).toBeCloseTo(1, 12)
    expect(blocks[1].start).toBe(3 / 18)
  })
})
