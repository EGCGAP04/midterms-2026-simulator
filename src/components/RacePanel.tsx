// The race panel (docs/SPEC.md §4.5): the selected race in full, beside or
// under the map.

import type { Ref } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin, formatProbability, formatShare } from '../i18n/format.ts'
import { raceNotes } from '../i18n/raceNotes.ts'
import { raceShift, type Adjustments } from '../model/adjust.ts'
import type { Incumbency, Party, Race } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'
import { RedrawnMark } from './RedrawnMark.tsx'
import { outcomeClass, raceDetails, ratingClass, type RaceDetails } from './useRaceMap.ts'

interface RacePanelProps {
  view: ChamberView
  /** The local shifts (§3.5), to show a race's own. */
  adjustments: Adjustments
  /** The selected race's id. */
  selected: string | undefined
  /** The panel's element, to bring it into view. */
  ref?: Ref<HTMLElement>
}

interface CandidateRow {
  name: string
  party: Party
  label?: Incumbency
  /** Montana's shares at the slider, or the within-party shares of a DvD / RvR race. */
  share?: number
  /** Undefined when the seat is decided between two candidates of one party. */
  chance?: number
}

/** The winner at the slider first: by share when there are shares (MT3,
 * DvD, RvR), otherwise the winning party. Ties keep the REP slot first. */
function winnerFirst(rows: CandidateRow[], winner: Party): CandidateRow[] {
  const rank = (row: CandidateRow) => row.share ?? (row.party === winner ? 1 : 0)
  return rows.toSorted((a, b) => rank(b) - rank(a))
}

/** The candidates, the winner first. */
function candidateRows(details: RaceDetails, chances: Record<Party, number> | undefined): CandidateRow[] {
  return winnerFirst(slotRows(details, chances), details.outcome.winner)
}

/** The candidates in slot order, the REP slot first. */
function slotRows({ race, outcome }: RaceDetails, chances: Record<Party, number> | undefined): CandidateRow[] {
  const chanceOf = (party: Party) => chances?.[party] ?? 0
  if (race.type === 'MT3' && race.shares && outcome.shares) {
    const { names, thirdLabel } = race.shares
    const { A, B, C } = outcome.shares
    const parties: [Party, Party, Party] = [race.rep?.party ?? 'R', race.opp?.party ?? 'I', 'D']
    return [
      { name: names[0], party: parties[0], label: race.rep?.label, share: A, chance: chanceOf(parties[0]) },
      { name: names[1], party: parties[1], label: race.opp?.label, share: B, chance: chanceOf(parties[1]) },
      { name: names[2], party: parties[2], label: thirdLabel, share: C, chance: chanceOf(parties[2]) },
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

/** The 2024 presidential margin and the last race for the seat. In a redrawn
 * district both were on the previous lines: an asterisk follows each margin. */
function ContextLine({ race }: { race: Race }) {
  const { lang, t } = useI18n()
  const { pres2024, last, redrawn } = race.context
  const mark = redrawn ? <RedrawnMark /> : null
  const margin = (value: number) => formatMargin(lang, value, { decimals: 1 })
  return (
    <p className="panel-context">
      {t('panel.pres', { margin: margin(pres2024) })}
      {mark}
      {last && (
        <>
          {' · '}
          {t(race.chamber === 'senate' ? 'panel.lastSenate' : 'panel.lastHouse', { year: last.year, margin: margin(last.margin) })}
          {mark}
        </>
      )}
    </p>
  )
}

/** The separator between two items of the heading. */
const Dot = () => (
  <span className="panel-dot" aria-hidden="true">
    ·
  </span>
)

/** Two opposed arrows: the seat changes hands. */
const FlipIcon = () => (
  <svg className="panel-flip-icon" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2 5h11M10 2l3 3-3 3M14 11H3M6 8l-3 3 3 3" />
  </svg>
)

export function RacePanel({ view, adjustments, selected, ref }: RacePanelProps) {
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
      {details ? <RaceDetailsView details={details} view={view} shift={raceShift(details.race, adjustments)} /> : <p className="panel-empty">{t('panel.empty')}</p>}
    </aside>
  )
}

interface RaceDetailsViewProps {
  details: RaceDetails
  view: ChamberView
  /** The race's local shift, R − opposition. */
  shift: number
}

function RaceDetailsView({ details, view, shift }: RaceDetailsViewProps) {
  const { lang, t } = useI18n()
  const { race, outcome, rating, flip } = details
  const rows = candidateRows(details, view.forecast.probabilities.get(race.id))
  const hasShare = rows.some((row) => row.share !== undefined)
  const hasChance = rows.some((row) => row.chance !== undefined)
  const notes = raceNotes(lang, race)
  const decided = race.fixedWinner !== undefined

  return (
    <>
      <div className="panel-head">
        <h3 className="panel-race">{details.name}</h3>
        <Dot />
        <span className={`panel-badge ${outcomeClass(outcome.winner, flip !== undefined)}`}>
          {flip && <FlipIcon />}
          {flip ? t('panel.flip', { from: flip.from, to: flip.to }) : t('panel.hold', { party: race.holder })}
        </span>
      </div>
      <p className="panel-rating">
        <span className={`panel-badge ${ratingClass(rating)}`}>{details.ratingText}</span>
        {details.margin && (
          <>
            <Dot />
            <span className={`panel-margin panel-party-${rating.party.toLowerCase()}`}>{details.margin}</span>
          </>
        )}
      </p>
      {shift !== 0 && <p className="panel-shift">{t('panel.shift', { shift: formatMargin(lang, shift, { decimals: 1 }) })}</p>}

      <table className="panel-candidates">
        <caption className="visually-hidden">{t('panel.candidates')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('panel.candidates')}</th>
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
              {hasChance && <td>{row.chance === undefined ? '' : formatProbability(lang, row.chance, { decided })}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="panel-heading">{t('panel.context')}</h4>
      <ContextLine race={race} />
      {race.context.redrawn && <p className="panel-redrawn">{t('panel.redrawn.note')}</p>}
      {notes.map((note) => (
        <p key={note} className="panel-note">
          {note}
        </p>
      ))}
    </>
  )
}
