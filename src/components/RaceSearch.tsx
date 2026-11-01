// Finding a race by district, state or candidate (docs/SPEC.md §4.4): a
// combobox with suggestions. Picking one selects the race.

import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatCount, raceName } from '../i18n/format.ts'
import type { Race } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'
import { searchEntry, searchRaces } from '../state/search.ts'

interface RaceSearchProps {
  view: ChamberView
  /** A race picked from the suggestions. */
  onPick: (id: string) => void
}

/** "David Valadao (R) · Randy Villegas (D)": the candidates, the REP slot
 * first (Montana's third too). */
function candidates(race: Race): string {
  const named = [race.rep, race.opp].filter((candidate) => candidate !== null)
  const list = named.map(({ name, party }) => `${name} (${party})`)
  if (race.shares) list.push(`${race.shares.names[2]} (D)`)
  return list.join(' · ')
}

export function RaceSearch({ view, onPick }: RaceSearchProps) {
  const { lang, t } = useI18n()
  const id = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  /** The highlighted suggestion, or -1 for none (Enter then picks the first). */
  const [active, setActive] = useState(-1)
  const { races, chamber } = view

  const entries = useMemo(() => races.map(searchEntry), [races])
  const results = useMemo(() => searchRaces(entries, query), [entries, query])
  const showing = open && query.trim() !== ''
  const optionId = (k: number) => `${id}-option-${k}`

  const pick = (k: number) => {
    // The field empties: the race panel and the map now show the race.
    setQuery('')
    setOpen(false)
    setActive(-1)
    onPick(races[k].id)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setOpen(true)
        setActive((current) => Math.min(current + 1, results.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((current) => Math.max(current - 1, 0))
        break
      case 'Enter':
        if (showing && results.length > 0) {
          event.preventDefault()
          pick(results[Math.max(active, 0)])
        }
        break
      case 'Escape':
        // First it closes the suggestions, then it clears the field (the
        // browser's own clearing of a search field waits for the second).
        if (showing) {
          event.preventDefault()
          setOpen(false)
        } else setQuery('')
        setActive(-1)
        break
    }
  }

  return (
    <div className="search">
      <label className="visually-hidden" htmlFor={`${id}-input`}>
        {t('search.label')}
      </label>
      <input
        id={`${id}-input`}
        className="search-input"
        type="search"
        role="combobox"
        aria-expanded={showing && results.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showing && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={t(chamber === 'senate' ? 'search.placeholder.senate' : 'search.placeholder.house')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={`${id}-list`} className="search-list" role="listbox" aria-label={t('search.label')} hidden={!showing || results.length === 0}>
        {showing &&
          results.map((k, position) => {
            const race = races[k]
            return (
              <li
                key={race.id}
                id={optionId(position)}
                role="option"
                aria-selected={position === active}
                className="search-option"
                // Keep the focus in the field, so it does not close first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(k)}
              >
                <span className="search-name">
                  {raceName(lang, race)} <span className="search-code">{race.id}</span>
                </span>
                <span className="search-candidates">{candidates(race)}</span>
              </li>
            )
          })}
      </ul>
      {showing && results.length === 0 && (
        <p className="search-none" aria-hidden="true">
          {t('search.none')}
        </p>
      )}
      <p className="visually-hidden" aria-live="polite">
        {showing && (results.length > 0 ? t('search.count', { count: formatCount(lang, results.length) }) : t('search.none'))}
      </p>
    </div>
  )
}
