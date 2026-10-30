// The summary bar (docs/SPEC.md §4.3): the chamber's seats by rating at the
// slider's environment, each side's seat total and its chance of control.

import { useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatCount, formatProbability } from '../i18n/format.ts'
import { HOUSE_MAJORITY, SENATE_R_CONTROL } from '../model/config.ts'
import { deltaFrom, outcomeAt } from '../model/margin.ts'
import { seatTotals, type SeatTotals } from '../model/seats.ts'
import { simulate, type Simulator } from '../model/simulate.ts'
import { summaryBlocks, type Block } from '../model/summary.ts'
import type { Chamber, Dataset, Party } from '../model/types.ts'

interface SummaryBarProps {
  chamber: Chamber
  env: number
  dataset: Dataset
  simulator: Simulator
}

const NONE: Partial<SeatTotals> = {}

const blockKey = (block: Block): string => `${block.side}-${block.party}-${block.kind}`

/** The CSS class that colours a block (shared with the maps). */
function ratingClass(block: Block): string {
  if (block.kind === 'independent') return 'rating-i'
  const bucket = block.kind === 'notUp' ? 'safe' : block.kind
  return `rating-${block.party.toLowerCase()}-${bucket}`
}

interface TotalProps {
  party: Party
  seats: number
}

function Total({ party, seats }: TotalProps) {
  const { lang, t } = useI18n()
  return (
    <div className="summary-total">
      <span className="summary-party">{t(`party.${party}`)}</span>
      <span className={`summary-seats summary-seats-${party.toLowerCase()}`}>{formatCount(lang, seats)}</span>
    </div>
  )
}

export function SummaryBar({ chamber, env, dataset, simulator }: SummaryBarProps) {
  const { lang, t } = useI18n()
  const [hovered, setHovered] = useState<string>()
  const notUp = chamber === 'senate' ? dataset.senateNotUp : NONE
  const delta = deltaFrom(env, dataset.g0)

  const races = useMemo(() => dataset.races.filter((race) => race.chamber === chamber), [dataset, chamber])
  const outcomes = useMemo(() => races.map((race) => outcomeAt(race, delta)), [races, delta])
  const forecast = useMemo(() => simulate(simulator, chamber, delta, notUp), [simulator, chamber, delta, notUp])
  const seats = seatTotals(outcomes, notUp)
  const blocks = summaryBlocks(races, outcomes, notUp)

  const blockName = (block: Block): string => {
    if (block.kind === 'notUp') return t('summary.notUpParty', { party: block.party })
    // An independent is named by the party it runs against.
    if (block.kind === 'independent') return t('summary.independent', { party: block.side === 'D' ? 'R' : 'D' })
    return t(`rating.${block.kind}`, { party: block.party })
  }

  const senate = chamber === 'senate'
  const showI = senate || seats.I > 0
  const line = senate
    ? t('summary.line.senate', { r: SENATE_R_CONTROL, di: SENATE_R_CONTROL + 1 })
    : t('summary.line.house', { seats: HOUSE_MAJORITY })
  const label = t('summary.bar', { chamber: t(`chamber.${chamber}`) })
  const shown = blocks.filter((block) => block.seats > 0)
  const tip = shown.find((block) => blockKey(block) === hovered)
  // Keep the tooltip inside the bar at either end.
  const tipAt = tip && Math.min(0.9, Math.max(0.1, tip.start + tip.share / 2))
  // The majority line, and in the Senate where the seats not up end.
  const lines = [
    0.5,
    ...blocks
      .filter((block) => block.kind === 'notUp')
      .map((block) => (block.side === 'D' ? block.share : block.start)),
  ]

  return (
    <section className="summary">
      <div className="summary-totals">
        <div className="summary-side">
          <div className="summary-parties">
            <Total party="D" seats={seats.D} />
            {showI && <Total party="I" seats={seats.I} />}
          </div>
          <p className="summary-chance">
            {t(senate ? 'summary.controlDI' : 'summary.majority')}:{' '}
            <strong>{formatProbability(lang, forecast.control.opposition)}</strong>
          </p>
        </div>
        <div className="summary-side summary-side-r">
          <div className="summary-parties">
            <Total party="R" seats={seats.R} />
          </div>
          <p className="summary-chance">
            {t(senate ? 'summary.control' : 'summary.majority')}:{' '}
            <strong>{formatProbability(lang, forecast.control.R)}</strong>
          </p>
        </div>
      </div>

      <p className="summary-line-label">{line}</p>
      <div className="summary-chart">
        <div
          className="summary-bar"
          role="img"
          aria-label={`${label}: ${shown.map((block) => `${blockName(block)} ${block.seats}`).join(', ')}`}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setHovered(undefined)
          }}
        >
          <div className="summary-blocks">
            {shown.map((block) => (
              <div
                key={blockKey(block)}
                className={`summary-block ${ratingClass(block)}${block.kind === 'notUp' ? ` summary-block-not-up summary-block-not-up-${block.side.toLowerCase()}` : ''}`}
                style={{ '--start': block.start, '--share': block.share } as CSSProperties}
                data-hovered={hovered === blockKey(block) || undefined}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setHovered(blockKey(block))
                }}
                // A touch ends with a pointerleave, so a tap toggles the tooltip instead.
                onPointerDown={(event) => {
                  const key = blockKey(block)
                  if (event.pointerType !== 'mouse') setHovered((current) => (current === key ? undefined : key))
                }}
              >
                <span className={`summary-block-label${block.seats >= 100 ? ' summary-block-label-wide' : ''}`}>
                  {formatCount(lang, block.seats)}
                </span>
              </div>
            ))}
          </div>
          {lines.map((at) => (
            <div key={at} className="summary-line" style={{ '--at': at } as CSSProperties} />
          ))}
        </div>
        {tip && (
          <div className="summary-tooltip" style={{ '--at': tipAt } as CSSProperties} aria-hidden="true">
            <strong>{formatCount(lang, tip.seats)}</strong> {blockName(tip)}
          </div>
        )}
        {senate && (
          <div className="summary-not-up" aria-hidden="true">
            {blocks
              .filter((block) => block.kind === 'notUp')
              .map((block) => (
                <span
                  key={block.party}
                  className={`summary-not-up-${block.party.toLowerCase()}`}
                  style={{ '--share': block.share } as CSSProperties}
                >
                  {t('summary.notUp')}
                </span>
              ))}
          </div>
        )}
      </div>

      <p className="summary-note">{t('summary.note', { sims: formatCount(lang, simulator.n) })}</p>

      <details className="summary-details">
        <summary>{t('summary.table')}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('summary.rating')}</th>
              <th scope="col">{t('summary.seats')}</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => (
              <tr key={blockKey(block)}>
                <th scope="row">
                  <span className={`summary-swatch ${ratingClass(block)}`} />
                  {blockName(block)}
                </th>
                <td>{formatCount(lang, block.seats)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
