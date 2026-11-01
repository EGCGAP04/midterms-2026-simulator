import { describe, expect, it } from 'vitest'
import type { Outcome } from './margin.ts'
import { blockMembers, independentSide, leaderName, summaryBlocks } from './summary.ts'
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

describe('leaderName', () => {
  const named = makeRace({ rep: candidate('R', 'Rita'), opp: candidate('D', 'Dan') })

  it('names the candidate of the party ahead', () => {
    expect(leaderName(named, { winner: 'R', margin: 0.1 })).toBe('Rita')
    expect(leaderName(named, { winner: 'D', margin: -0.1 })).toBe('Dan')
  })

  it('names the larger share in a same-party race', () => {
    const dvd = makeRace({ type: 'DvD', rep: candidate('D', 'Ann'), opp: candidate('D', 'Bea'), intraShares: [0.36, 0.64] })
    expect(leaderName(dvd, { winner: 'D', margin: -1 })).toBe('Bea')
  })

  it('names Montana’s third candidate when D leads', () => {
    const mt = makeRace({
      type: 'MT3',
      rep: candidate('R', 'Alme'),
      opp: candidate('I', 'Bodnar'),
      shares: { A: 0.3, B: 0.3, C: 0.4, names: ['Alme', 'Bodnar', 'Bankhead'] },
    })
    expect(leaderName(mt, { winner: 'D', margin: -0.1 })).toBe('Bankhead')
    expect(leaderName(mt, { winner: 'I', margin: -0.1 })).toBe('Bodnar')
  })
})

describe('blockMembers', () => {
  it('lists a rating block’s races with their margins', () => {
    const blocks = summaryBlocks(races, outcomes)
    const tiltD = blocks.find((block) => block.kind === 'tilt' && block.party === 'D')
    expect(tiltD && blockMembers(tiltD, races, outcomes)).toEqual([{ name: 'D candidate', place: 'XX-01', margin: -0.01, party: 'D' }])
  })

  it('lists the races by result, the smallest margin first and the fixed races last', () => {
    const block = summaryBlocks(races, outcomes).find((b) => b.kind === 'safe' && b.party === 'D')
    const ordered = [
      makeRace({ id: 'A' }),
      makeRace({ id: 'B', type: 'DvD', fixedWinner: 'D', opp: candidate('D') }),
      makeRace({ id: 'C' }),
      makeRace({ id: 'D' }),
    ]
    const margins = [-0.4, -1, -0.2, -0.3]
    const members = block && blockMembers(block, ordered, margins.map((margin) => ({ winner: 'D', margin })))
    expect(members?.map(({ place }) => place)).toEqual(['C', 'D', 'A', 'B'])
  })

  it('lists the independents on their side', () => {
    const blocks = summaryBlocks(races, outcomes)
    const left = blocks.find((block) => block.kind === 'independent' && block.side === 'D')
    expect(left && blockMembers(left, races, outcomes).map(({ party }) => party)).toEqual(['I', 'I'])
  })

  it('lists the senators not up of the block’s party, without a margin', () => {
    const senators = [
      { state: 'VT', name: 'Bernie Sanders', party: 'I' },
      { state: 'VT', name: 'Peter Welch', party: 'D' },
    ] as const
    const blocks = summaryBlocks(races, outcomes, { D: 1, I: 1 })
    const notUpI = blocks.find((block) => block.kind === 'notUp' && block.party === 'I')
    expect(notUpI && blockMembers(notUpI, races, outcomes, senators)).toEqual([{ name: 'Bernie Sanders', place: 'VT', party: 'I' }])
  })
})
