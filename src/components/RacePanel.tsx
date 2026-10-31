// The race panel (docs/SPEC.md §4.5): the selected race in full, beside or
// under the map.

import type { Ref } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin, formatProbability, formatShare } from '../i18n/format.ts'
import type { Lang } from '../i18n/i18n.ts'
import { raceNotes } from '../i18n/raceNotes.ts'
import { flipOf } from '../model/flips.ts'
import type { Incumbency, Party, Race } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'
import { raceDetails, ratingClass, type RaceDetails } from './useRaceMap.ts'

interface RacePanelProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  /** The panel's element, to bring it into view. */
  ref?: Ref<HTMLElement>
}

interface CandidateRow {
  name: string
  party: Party
  /** Unknown for Montana's third candidate. */
  label?: Incumbency
  /** Montana's shares at the slider, or the within-party shares of a DvD / RvR race. */
  share?: number
  /** Undefined when the seat is decided between two candidates of one party. */
  chance?: number
}

/** The candidates, the REP slot first. */
function candidateRows({ race, outcome }: RaceDetails, chances: Record<Party, number> | undefined): CandidateRow[] {
  const chanceOf = (party: Party) => chances?.[party] ?? 0
  if (race.type === 'MT3' && race.shares && outcome.shares) {
    const { names } = race.shares
    const { A, B, C } = outcome.shares
    const parties: [Party, Party, Party] = [race.rep?.party ?? 'R', race.opp?.party ?? 'I', 'D']
    return [
      { name: names[0], party: parties[0], label: race.rep?.label, share: A, chance: chanceOf(parties[0]) },
      { name: names[1], party: parties[1], label: race.opp?.label, share: B, chance: chanceOf(parties[1]) },
      { name: names[2], party: parties[2], share: C, chance: chanceOf(parties[2]) },
    ]
  }
  const sameParty = race.type === 'DvD' || race.type === 'RvR'
  return [race.rep, race.opp].flatMap<CandidateRow>((candidate, slot) => {
    if (candidate === null) return []
    const { name, party, label } = candidate
    return sameParty
      ? [{ name, party, label, share: race.intraShares?.[slot] }]
      : [{ name, party, label, chance: chanceOf(party) }]
  })
}

/** The 2024 presidential margin and the last race for the seat. */
function contextLine(lang: Lang, t: ReturnType<typeof useI18n>['t'], race: Race): string {
  const { pres2024, last, redrawn } = race.context
  const parts = [t('panel.pres', { margin: formatMargin(lang, pres2024, { decimals: 1 }) })]
  if (last) {
    const values = { year: last.year, margin: formatMargin(lang, last.margin, { decimals: 1 }) }
    if (race.chamber === 'senate') parts.push(t('panel.lastSenate', values))
    else parts.push(t(redrawn ? 'panel.lastHouseOld' : 'panel.lastHouse', values))
  }
  return parts.join(' · ')
}

export function RacePanel({ view, selected, ref }: RacePanelProps) {
  const { lang, t } = useI18n()
  const k = selected === undefined ? -1 : view.races.findIndex((race) => race.id === selected)
  const details = k === -1 ? undefined : raceDetails(lang, view, k)

  return (
    <aside ref={ref} className="panel" aria-labelledby="panel-title">
      <h2 id="panel-title" className="panel-title">
        {t('panel.title')}
      </h2>
      {/* Says which race is shown, once per selection: not on every slider step. */}
      <p className="visually-hidden" aria-live="polite">
        {details && t('panel.showing', { name: details.name })}
      </p>
      {details ? <RaceDetailsView details={details} view={view} /> : <p className="panel-empty">{t('panel.empty')}</p>}
    </aside>
  )
}

function RaceDetailsView({ details, view }: { details: RaceDetails; view: ChamberView }) {
  const { lang, t } = useI18n()
  const { race, outcome, rating } = details
  const flip = flipOf(race, outcome)
  const rows = candidateRows(details, view.forecast.probabilities.get(race.id))
  const hasShare = rows.some((row) => row.share !== undefined)
  const hasChance = rows.some((row) => row.chance !== undefined)
  const notes = raceNotes(lang, race)

  return (
    <>
      <h3 className="panel-race">{details.name}</h3>
      <p className="panel-rating">
        <span className={`panel-badge ${ratingClass(rating)}`}>{details.ratingText}</span>
        {details.margin && <span className="panel-margin">{details.margin}</span>}
      </p>
      <p className={`panel-flip${flip ? ' panel-flip-yes' : ''}`}>
        {flip ? t('panel.flip', { from: flip.from, to: flip.to }) : t('panel.hold', { party: race.holder })}
      </p>

      <table className="panel-candidates">
        <caption className="visually-hidden">{t('panel.candidates')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('panel.candidate')}</th>
            {hasShare && <th scope="col">{t('panel.share')}</th>}
            {hasChance && <th scope="col">{t('panel.chance')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">
                <span className={`panel-party panel-party-${row.party.toLowerCase()}`}>{row.party}</span>
                <span className="panel-name">
                  {row.name}
                  {row.label && <span className="panel-label">{t(`incumbency.${row.label}`)}</span>}
                </span>
              </th>
              {hasShare && <td>{row.share === undefined ? '' : formatShare(lang, row.share)}</td>}
              {hasChance && <td>{row.chance === undefined ? '' : formatProbability(lang, row.chance)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="panel-heading">{t('panel.context')}</h4>
      <p className="panel-context">{contextLine(lang, t, race)}</p>
      {notes.map((note) => (
        <p key={note} className="panel-note">
          {note}
        </p>
      ))}
    </>
  )
}
