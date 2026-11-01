// The seat histogram (docs/SPEC.md §4.6): how many seats R wins across the
// simulations at the slider's environment, with the line where control
// starts, and each party's median and 80% interval.

import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatCount, formatShare } from '../i18n/format.ts'
import { HOUSE_MAJORITY, SENATE_R_CONTROL } from '../model/config.ts'
import { seatBars, seatTicks } from '../model/histogram.ts'
import type { Party } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'
import { useTouchDismiss } from './useTouchDismiss.ts'

interface SeatHistogramProps {
  view: ChamberView
}

/** The bars' height, in the SVG's own units (it stretches to the frame). */
const HEIGHT = 100
/** The smallest share the tooltip shows as a number (0.1%). */
const MIN_SHARE = 0.001

export function SeatHistogram({ view }: SeatHistogramProps) {
  const { lang, t } = useI18n()
  const [hovered, setHovered] = useState<number>()
  // A tap keeps its bar's tooltip until a touch elsewhere.
  const chart = useRef<HTMLDivElement>(null)
  useTouchDismiss(chart, hovered !== undefined, () => setHovered(undefined))
  const { chamber, forecast, sims } = view
  const senate = chamber === 'senate'
  const control = senate ? SENATE_R_CONTROL : HOUSE_MAJORITY
  const bars = seatBars(forecast.seats.R.histogram)
  if (!bars) return null

  const { lo, hi, shares } = bars
  const count = hi - lo + 1
  const tallest = Math.max(...shares)
  /** Where a seat count's bar is centred, as a share of the width. */
  const at = (seats: number) => (seats - lo + 0.5) / count
  const seatsText = (seats: number) => formatCount(lang, seats)
  // A count a few simulations reach would round to 0.0%.
  const shareText = (share: number) => (share < MIN_SHARE ? `<${formatShare(lang, MIN_SHARE)}` : formatShare(lang, share))

  // The bar under the pointer: anywhere in its column, so thin bars are easy
  // to hit.
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect()
    const k = Math.floor(((event.clientX - left) / width) * count)
    setHovered(k >= 0 && k < count ? lo + k : undefined)
  }

  const { R } = forecast.seats
  // I only when some simulation gives an independent a seat.
  const parties: Party[] = forecast.seats.I.histogram[0] < sims ? ['D', 'R', 'I'] : ['D', 'R']
  const lineInRange = control > lo && control <= hi

  return (
    <section className="histogram" aria-labelledby="histogram-title">
      <h2 id="histogram-title" className="histogram-title">
        {t('hist.title')}
      </h2>
      <p className="histogram-desc">{t('hist.desc', { sims: seatsText(sims) })}</p>

      <div
        ref={chart}
        className="histogram-chart"
        onPointerMove={point}
        onPointerDown={point}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setHovered(undefined)
        }}
      >
        <svg
          className="histogram-bars"
          viewBox={`0 0 ${count} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t('hist.aria', {
            median: seatsText(R.median),
            lo: seatsText(R.interval80[0]),
            hi: seatsText(R.interval80[1]),
          })}
        >
          {shares.map((share, k) => {
            const seats = lo + k
            const height = (share / tallest) * HEIGHT
            return (
              <rect
                key={seats}
                className={`histogram-bar ${seats >= control ? 'histogram-bar-r' : 'histogram-bar-d'}${seats === hovered ? ' histogram-bar-hover' : ''}`}
                x={k}
                y={HEIGHT - height}
                width={1}
                height={height}
              />
            )
          })}
        </svg>

        {lineInRange && (
          <div className="histogram-line" style={{ '--at': (control - lo) / count } as CSSProperties}>
            <span className="histogram-line-label">
              {senate
                ? t('hist.line.senate', { seats: seatsText(control) })
                : t('summary.line.house', { seats: seatsText(control) })}
            </span>
          </div>
        )}

        {hovered !== undefined && (
          <div className="histogram-tooltip" style={{ '--at': at(hovered) } as CSSProperties} aria-hidden="true">
            {t('hist.bar', { seats: seatsText(hovered), share: shareText(shares[hovered - lo]) })}
          </div>
        )}
      </div>

      <div className="histogram-axis" aria-hidden="true">
        {seatTicks(lo, hi).map((tick) => (
          <span key={tick} style={{ '--at': at(tick) } as CSSProperties}>
            {seatsText(tick)}
          </span>
        ))}
      </div>
      <p className="histogram-axis-label">{t('hist.axis')}</p>

      <ul className="histogram-legend">
        <li>
          <span className="histogram-swatch histogram-bar-r" aria-hidden="true" />
          {t(senate ? 'hist.legend.senate.R' : 'hist.legend.house.R', { seats: seatsText(control) })}
        </li>
        <li>
          <span className="histogram-swatch histogram-bar-d" aria-hidden="true" />
          {t(senate ? 'hist.legend.senate.other' : 'hist.legend.house.other', { seats: seatsText(control) })}
        </li>
      </ul>

      <table className="histogram-table">
        <caption>{t('hist.table')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('hist.party')}</th>
            <th scope="col">{t('hist.median')}</th>
            <th scope="col">{t('hist.interval')}</th>
          </tr>
        </thead>
        <tbody>
          {parties.map((party) => {
            const { median, interval80 } = forecast.seats[party]
            return (
              <tr key={party}>
                <th scope="row">{t(`party.${party}`)}</th>
                <td>{seatsText(median)}</td>
                <td>{t('hist.range', { lo: seatsText(interval80[0]), hi: seatsText(interval80[1]) })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
