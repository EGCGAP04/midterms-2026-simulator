import { describe, expect, it } from 'vitest'
import { countRatings, type Rating } from './ratings.ts'
import { summaryBlocks } from './summary.ts'

const ratings = (party: Rating['party'], bucket: Rating['bucket'], count: number): Rating[] =>
  Array.from({ length: count }, () => ({ party, bucket }))

const counts = countRatings([
  ...ratings('D', 'safe', 5),
  ...ratings('D', 'tilt', 1),
  ...ratings('I', 'lean', 1),
  ...ratings('I', 'safe', 1),
  ...ratings('R', 'likely', 2),
])

describe('summaryBlocks', () => {
  it('runs from Safe D to Safe R, with independents in the middle', () => {
    expect(summaryBlocks(counts).map((block) => `${block.kind} ${block.party} ${block.seats}`)).toEqual([
      'safe D 5',
      'likely D 0',
      'lean D 0',
      'tilt D 1',
      'independent I 2',
      'tilt R 0',
      'lean R 0',
      'likely R 2',
      'safe R 0',
    ])
  })

  it('puts the seats not up at the two ends', () => {
    const blocks = summaryBlocks(counts, { D: 3, R: 4 })
    expect(blocks[0]).toMatchObject({ party: 'D', kind: 'notUp', seats: 3, start: 0 })
    expect(blocks.at(-1)).toMatchObject({ party: 'R', kind: 'notUp', seats: 4 })
  })

  it('places each block right after the one before, filling the bar', () => {
    const blocks = summaryBlocks(counts, { D: 3, R: 4 })
    expect(blocks.reduce((sum, block) => sum + block.seats, 0)).toBe(17)
    blocks.slice(1).forEach((block, i) => {
      expect(block.start).toBeCloseTo(blocks[i].start + blocks[i].share, 12)
    })
    const last = blocks[blocks.length - 1]
    expect(last.start + last.share).toBeCloseTo(1, 12)
    expect(blocks[1].start).toBe(3 / 17)
  })
})
