// Small hand-made races for the model's unit tests.

import type { Candidate, Race } from './types.ts'

export function candidate(party: Candidate['party'], name = `${party} candidate`): Candidate {
  return { name, label: 'nonIncumbent', party }
}

export function makeRace(overrides: Partial<Race> = {}): Race {
  return {
    id: 'XX-01',
    chamber: 'house',
    state: 'XX',
    name: 'Test 01',
    type: 'normal',
    holder: 'R',
    rep: candidate('R'),
    opp: candidate('D'),
    m0: 0,
    slope: 1,
    workbookRating: 'Tossup (Tilt R)',
    context: { pres2024: 0, last: null },
    ...overrides,
  }
}
