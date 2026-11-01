// The summary bar (docs/SPEC.md §4.3): the chamber's seats by rating at the
// slider's environment, each side's seat total and its chance of control.
// Each block lists who it stands for: a preview on hover, the whole list once
// clicked or tapped.

import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatCount, formatMargin, formatProbability } from '../i18n/format.ts'
import { HOUSE_MAJORITY, SENATE_R_CONTROL } from '../model/config.ts'
import { seatTotals } from '../model/seats.ts'
import { blockMembers, summaryBlocks, type Block } from '../model/summary.ts'
import type { Party } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'

/** How many members a hover shows. */
const PREVIEW = 12

interface SummaryBarProps {
  view: ChamberView
}

const blockKey = (block: Block): string => `${block.side}-${block.party}-${block.kind}`

/** The CSS class that colours a block (shared with the maps). */
function ratingClass(block: Block): string {
  if (block.party === 'I') return 'rating-i'
  const bucket = block.kind === 'notUp' ? 'safe' : block.kind
  return `rating-${block.party.toLowerCase()}-${bucket}`
}

/** An independents' swatch in the table gets a triangle of its side's
 * colour: Safe for those not up, who caucus with D; Tilt for those ahead in a
 * race, by the party they run against. */
function swatchClass(block: Block): string {
  if (block.party !== 'I') return `summary-swatch ${ratingClass(block)}`
  const shade = block.kind === 'notUp' ? 'safe' : 'tilt'
  return `summary-swatch ${ratingClass(block)} summary-swatch-half summary-swatch-half-${block.side.toLowerCase()}-${shade}`
}

/** Where the seats not up end on each side, as a share of the chamber. */
function notUpSpans(blocks: readonly Block[]): { side: Block['side']; start: number; end: number }[] {
  return (['D', 'R'] as const).flatMap((side) => {
    const own = blocks.filter((block) => block.kind === 'notUp' && block.side === side && block.seats > 0)
    if (own.length === 0) return []
    return [{ side, start: Math.min(...own.map((b) => b.start)), end: Math.max(...own.map((b) => b.start + b.share)) }]
  })
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

export function SummaryBar({ view }: SummaryBarProps) {
  const { lang, t } = useI18n()
  const [hovered, setHovered] = useState<string>()
  /** The block whose whole list is open, after a click or a tap. */
  const [pinned, setPinned] = useState<string>()
  const chart = useRef<HTMLDivElement>(null)
  const listId = useId()
  const { chamber, races, outcomes, forecast, notUp, senatorsNotUp } = view
  const seats = seatTotals(outcomes, notUp)
  const blocks = summaryBlocks(races, outcomes, notUp)

  // An open list closes with Escape or a click or touch outside the chart.
  useEffect(() => {
    if (pinned === undefined) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && chart.current?.contains(event.target)) return
      setPinned(undefined)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(undefined)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pinned])

  const blockName = (block: Block): string => {
    if (block.kind === 'notUp' && block.party === 'I') return t('summary.notUpIndependent', { party: block.side })
    if (block.kind === 'notUp') return t('summary.notUpParty', { party: block.party })
    // An independent is named by the party it runs against.
    if (block.kind === 'independent') return t('summary.independent', { party: block.side === 'D' ? 'R' : 'D' })
    return t(`rating.${block.kind}`, { party: block.party })
  }

  const senate = chamber === 'senate'
  // Independents are totalled on the side of the bar their races are on.
  const independents = (side: Block['side']): number =>
    blocks.reduce((sum, block) => (block.party === 'I' && block.side === side ? sum + block.seats : sum), 0)
  const leftI = independents('D')
  const rightI = independents('R')
  const line = senate
    ? t('summary.line.senate', { r: SENATE_R_CONTROL, di: SENATE_R_CONTROL + 1 })
    : t('summary.line.house', { seats: HOUSE_MAJORITY })
  const label = t('summary.bar', { chamber: t(`chamber.${chamber}`) })
  const shown = blocks.filter((block) => block.seats > 0)
  const open = pinned ?? hovered
  const tip = shown.find((block) => blockKey(block) === open)
  const tipAt = tip && tip.start + tip.share / 2
  const members = tip ? blockMembers(tip, races, outcomes, senatorsNotUp) : []
  const listed = pinned === undefined ? members.slice(0, PREVIEW) : members
  // The majority line, and in the Senate where the seats not up end.
  const spans = notUpSpans(blocks)
  const lines = [0.5, ...spans.map(({ side, start, end }) => (side === 'D' ? end : start))]

  return (
    <section className="summary">
      <div className="summary-totals">
        <div className="summary-side">
          <div className="summary-parties">
            <Total party="D" seats={seats.D} />
            {(senate || leftI > 0) && <Total party="I" seats={leftI} />}
          </div>
          <p className="summary-chance">
            {t(senate ? 'summary.controlDI' : 'summary.majority')}:{' '}
            <strong>{formatProbability(lang, forecast.control.opposition)}</strong>
          </p>
        </div>
        <div className="summary-side summary-side-r">
          <div className="summary-parties">
            {rightI > 0 && <Total party="I" seats={rightI} />}
            <Total party="R" seats={seats.R} />
          </div>
          <p className="summary-chance">
            {t(senate ? 'summary.control' : 'summary.majority')}:{' '}
            <strong>{formatProbability(lang, forecast.control.R)}</strong>
          </p>
        </div>
      </div>

      <p className="summary-line-label">{line}</p>
      <div ref={chart} className="summary-chart">
        <div
          className="summary-bar"
          role="group"
          aria-label={label}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setHovered(undefined)
          }}
        >
          <div className="summary-blocks">
            {shown.map((block) => {
              const key = blockKey(block)
              return (
                <button
                  key={key}
                  type="button"
                  className={`summary-block ${ratingClass(block)}${block.kind === 'notUp' ? ` summary-block-not-up summary-block-not-up-${block.side.toLowerCase()}` : ''}`}
                  style={{ '--start': block.start, '--share': block.share } as CSSProperties}
                  aria-label={`${blockName(block)}: ${formatCount(lang, block.seats)}`}
                  aria-expanded={pinned === key}
                  aria-controls={listId}
                  data-hovered={open === key || undefined}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') setHovered(key)
                  }}
                  // The keyboard's focus previews the list, as a hover does.
                  onFocus={(event: FocusEvent<HTMLElement>) => {
                    if (event.currentTarget.matches(':focus-visible')) setHovered(key)
                  }}
                  onBlur={() => setHovered((current) => (current === key ? undefined : current))}
                  // A click, a tap, Enter or Space opens the whole list, or closes it.
                  onClick={() => setPinned((current) => (current === key ? undefined : key))}
                >
                  <span className={`summary-block-label${block.seats >= 100 ? ' summary-block-label-wide' : ''}`}>
                    {formatCount(lang, block.seats)}
                  </span>
                </button>
              )
            })}
          </div>
          {lines.map((at) => (
            <div key={at} className="summary-line" style={{ '--at': at } as CSSProperties} />
          ))}
        </div>
        <div
          id={listId}
          className={`summary-tooltip${pinned === undefined ? '' : ' summary-tooltip-pinned'}`}
          style={{ '--at': tipAt } as CSSProperties}
          hidden={!tip}
          // A hover's preview repeats the block's label; the open list is read.
          aria-hidden={pinned === undefined}
        >
          {tip && (
            <>
              <p className="summary-tooltip-head">
                <span>
                  <strong>{formatCount(lang, tip.seats)}</strong> {blockName(tip)}
                </span>
                {pinned !== undefined && (
                  <button type="button" className="summary-tooltip-close" aria-label={t('summary.close')} onClick={() => setPinned(undefined)}>
                    ×
                  </button>
                )}
              </p>
              <ul className="summary-members" tabIndex={pinned === undefined ? undefined : 0} aria-label={blockName(tip)}>
                {listed.map((member) => (
                  <li key={`${member.place}-${member.name}`}>
                    <span className="summary-member-name">{member.name}</span>
                    <span className="summary-member-place">{member.place}</span>
                    {member.margin !== undefined && (
                      <span className={`summary-member-margin panel-party-${member.party.toLowerCase()}`}>
                        {formatMargin(lang, member.margin, { ahead: member.party, decimals: 1 })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {listed.length < members.length && (
                <p className="summary-more">{t('summary.more', { count: formatCount(lang, members.length - listed.length) })}</p>
              )}
            </>
          )}
        </div>
        {senate && (
          <div className="summary-not-up" aria-hidden="true">
            {spans.map(({ side, start, end }) => (
              <span
                key={side}
                className={`summary-not-up-${side.toLowerCase()}`}
                style={{ '--share': end - start } as CSSProperties}
              >
                {t('summary.notUp')}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="summary-note">{t('summary.note', { sims: formatCount(lang, view.sims) })}</p>

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
                  <span className={swatchClass(block)} />
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
