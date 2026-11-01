// The lists under the map (docs/SPEC.md §4.7): flips, the closest races and
// the tipping-point race. Each race is a button that selects it.

import { useId, useMemo, useState } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatCount } from '../i18n/format.ts'
import { HOUSE_MAJORITY, SENATE_R_CONTROL } from '../model/config.ts'
import { closestRaces, flipsByLoser, tippingPoint } from '../model/lists.ts'
import type { Party } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'
import { raceDetails, ratingClass } from './useRaceMap.ts'

interface RaceListsProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  onSelect: (id: string | undefined) => void
}

/** The parties whose seats can flip: always R and D, I only if it holds one. */
const LOSERS: readonly Party[] = ['R', 'D', 'I']
/** How many flips a column shows until "Show all" is pressed. */
const FLIPS_SHOWN = 10

export function RaceLists({ view, selected, onSelect }: RaceListsProps) {
  const { lang, t } = useI18n()
  const { chamber, races, outcomes, notUp } = view
  const senate = chamber === 'senate'
  const listId = useId()
  // The flip columns showing every race.
  const [expanded, setExpanded] = useState<ReadonlySet<Party>>(new Set())
  const toggleColumn = (party: Party) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(party)) next.add(party)
      return next
    })

  const lists = useMemo(
    () => ({
      flips: flipsByLoser(races, outcomes),
      closest: closestRaces(races, outcomes),
      tipping: tippingPoint(races, outcomes, senate ? SENATE_R_CONTROL : HOUSE_MAJORITY, notUp.R),
    }),
    [races, outcomes, senate, notUp],
  )

  /** A race as a button: a click selects it, or clears it if selected. */
  const item = (k: number) => {
    const details = raceDetails(lang, view, k)
    const { id } = details.race
    return (
      <li key={id}>
        <button
          type="button"
          className="list-race"
          aria-pressed={selected === id}
          onClick={() => onSelect(selected === id ? undefined : id)}
        >
          <span className={`list-swatch ${ratingClass(details.rating)}`} aria-hidden="true" />
          <span className="list-name">{details.name}</span>
          {/* A fixed race has no real margin: its rating instead. */}
          <span className="list-margin">{details.margin ?? details.ratingText}</span>
        </button>
      </li>
    )
  }

  const none = <p className="list-none">{t('lists.none')}</p>

  return (
    <section className="lists" aria-labelledby="lists-title">
      <details className="section-details" open>
        <summary>
          <h2 id="lists-title" className="lists-title">
            {t('lists.title')}
          </h2>
        </summary>

        <div className="lists-grid">
          <section className="list-block list-flips">
            <h3>{t('lists.flips')}</h3>
            <div className="list-columns">
              {LOSERS.filter((party) => party !== 'I' || lists.flips.I.length > 0).map((party) => {
                const flips = lists.flips[party]
                const open = expanded.has(party)
                const id = `${listId}-${party}`
                return (
                  <div key={party}>
                    <h4>{t('lists.flips.loses', { party, count: formatCount(lang, flips.length) })}</h4>
                    {flips.length > 0 ? (
                      <ul id={id} className="list">
                        {(open ? flips : flips.slice(0, FLIPS_SHOWN)).map(item)}
                      </ul>
                    ) : (
                      none
                    )}
                    {flips.length > FLIPS_SHOWN && (
                      <button
                        type="button"
                        className="list-more"
                        aria-expanded={open}
                        aria-controls={id}
                        onClick={() => toggleColumn(party)}
                      >
                        {open ? t('lists.showFewer') : t('lists.showAll', { count: formatCount(lang, flips.length) })}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="list-block">
            <h3>{t('lists.closest')}</h3>
            <ol className="list">{lists.closest.map(item)}</ol>
            <p className="list-note">{t('lists.closest.note')}</p>
          </section>

          <section className="list-block">
            <h3>{t('lists.tipping')}</h3>
            {lists.tipping !== undefined && <ul className="list">{item(lists.tipping)}</ul>}
            <p className="list-note">
              {senate ? t('lists.tipping.senate') : t('lists.tipping.house', { seats: formatCount(lang, HOUSE_MAJORITY) })}
            </p>
          </section>
        </div>
      </details>
    </section>
  )
}
