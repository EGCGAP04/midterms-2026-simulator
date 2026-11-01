// The race panel's notes on how a race works (docs/SPEC.md §4.5).

import type { Race } from '../model/types.ts'
import { formatPercent } from './format.ts'
import { translate, type Lang } from './i18n.ts'

/** One line per note: the race type first, then an independent's slot. */
export function raceNotes(lang: Lang, race: Race): string[] {
  const notes: string[] = []
  switch (race.type) {
    case 'blend':
      // Alaska's primary is top-four; California's, top-two.
      notes.push(
        translate(lang, race.state === 'AK' ? 'note.blendAK' : 'note.blend', { share: formatPercent(lang, race.slope) }),
      )
      break
    case 'uncontested':
    case 'DvD':
    case 'RvR':
      notes.push(translate(lang, `note.${race.type}`))
      break
    case 'MT3':
      if (race.shares) {
        const [a, b, c] = race.shares.names
        notes.push(translate(lang, 'note.MT3', { a, b, c }))
      }
      break
    case 'normal':
      break
  }
  // In MT3 all three parties run, so the independent takes nobody's place.
  if (race.type !== 'MT3') {
    if (race.rep?.party === 'I') notes.push(translate(lang, 'note.independent.R'))
    if (race.opp?.party === 'I') notes.push(translate(lang, 'note.independent.D'))
  }
  // An independent who caucuses with a party counts toward its majority (§2.3).
  for (const candidate of [race.rep, race.opp]) {
    if (candidate?.caucus) notes.push(translate(lang, `note.caucus.${candidate.caucus}`, { name: candidate.name }))
  }
  return notes
}
