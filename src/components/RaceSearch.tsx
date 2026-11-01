// Finding a race by district, state or candidate (docs/SPEC.md §4.4).
// Picking one selects the race.

import { useMemo } from 'react'
import { useI18n } from '../i18n/context.ts'
import { raceName } from '../i18n/format.ts'
import type { ChamberView } from '../state/forecast.ts'
import { candidateList, searchEntry } from '../state/search.ts'
import { SearchBox } from './SearchBox.tsx'

interface RaceSearchProps {
  view: ChamberView
  /** A race picked from the suggestions. */
  onPick: (id: string) => void
}

export function RaceSearch({ view, onPick }: RaceSearchProps) {
  const { lang, t } = useI18n()
  const { races, chamber } = view
  const entries = useMemo(() => races.map(searchEntry), [races])

  return (
    <SearchBox
      items={races}
      entries={entries}
      label={t('search.label')}
      placeholder={t(chamber === 'senate' ? 'search.placeholder.senate' : 'search.placeholder.house')}
      itemKey={(race) => race.id}
      renderItem={(race) => (
        <>
          <span className="search-name">
            {raceName(lang, race)} <span className="search-code">{race.id}</span>
          </span>
          <span className="search-candidates">{candidateList(race)}</span>
        </>
      )}
      onPick={(race) => onPick(race.id)}
    />
  )
}
