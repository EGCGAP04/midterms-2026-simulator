// The Senate map (docs/SPEC.md §4.4): every state with a race in the colour
// of its rating at the slider, the others in grey, and squares for the small
// North-East states.

import { useId, useMemo, useState, type CSSProperties, type FocusEvent, type MouseEvent, type PointerEvent } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin, formatProbability, raceName } from '../i18n/format.ts'
import { ratingOf, type Rating } from '../model/ratings.ts'
import { independentSide } from '../model/summary.ts'
import { ATLAS_HEIGHT, ATLAS_WIDTH, useAtlas } from '../state/atlas.ts'
import type { ChamberView } from '../state/forecast.ts'

interface SenateMapProps {
  view: ChamberView
  /** The selected race's id. */
  selected: string | undefined
  onSelect: (id: string | undefined) => void
}

/** The small states that also get a square, top to bottom. */
const SMALL_STATES = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD']
const SQUARE = 30
const SQUARE_GAP = 6
const SQUARE_X = 925
const SQUARE_TOP = 150

function squareAt(index: number): { x: number; y: number } {
  return { x: SQUARE_X, y: SQUARE_TOP + index * (SQUARE + SQUARE_GAP) }
}

/** The CSS class that colours a race (shared with the summary bar). */
function ratingClass(rating: Rating): string {
  return rating.party === 'I' ? 'rating-i' : `rating-${rating.party.toLowerCase()}-${rating.bucket}`
}

export function SenateMap({ view, selected, onSelect }: SenateMapProps) {
  const { lang, t } = useI18n()
  const atlas = useAtlas()
  const [hovered, setHovered] = useState<string>()
  const hatch = `hatch-${useId()}`
  const { races, outcomes, forecast } = view

  // Each state's race, by postal code (one per state in 2026).
  const raceIndex = useMemo(() => new Map(races.map((race, k) => [race.state, k])), [races])
  const hasFixed = races.some((race) => race.fixedWinner !== undefined)

  const describe = (k: number) => {
    const race = races[k]
    const outcome = outcomes[k]
    const rating = ratingOf(outcome)
    const name = raceName(lang, race)
    // An independent is named by the party it runs against.
    const ratingText =
      rating.party === 'I'
        ? t('summary.independent', { party: independentSide(race) === 'D' ? 'R' : 'D' })
        : t(`rating.${rating.bucket}`, { party: rating.party })
    const margin = formatMargin(lang, outcome.margin, { ahead: outcome.winner })
    const chance = forecast.probabilities.get(race.id)?.[outcome.winner] ?? 0
    return { race, rating, name, ratingText, margin, chance }
  }

  // Mouse hover only: a touch also ends with a pointerleave, so a tap selects.
  const hover = (id: string) => ({
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered(id)
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered((current) => (current === id ? undefined : current))
    },
    onClick: (event: MouseEvent) => {
      // The map's background clears the selection.
      event.stopPropagation()
      onSelect(selected === id ? undefined : id)
    },
  })

  const active = hovered ?? selected
  const activeIndex = races.findIndex((race) => race.id === active)
  const tip = activeIndex === -1 ? undefined : describe(activeIndex)

  if (atlas.status !== 'ready') {
    return (
      <section className="map">
        <div className="map-frame">
          <p className="status" role={atlas.status === 'error' ? 'alert' : 'status'}>
            {t(atlas.status === 'error' ? 'map.loadError' : 'map.loading')}
          </p>
        </div>
      </section>
    )
  }

  const shapeOf = (postal: string) => atlas.states.find((shape) => shape.postal === postal)
  // The tooltip points at a small state's square, otherwise at the state.
  const anchor = (postal: string): [number, number] | undefined => {
    const small = SMALL_STATES.indexOf(postal)
    if (small !== -1) {
      const { x, y } = squareAt(small)
      return [x + SQUARE / 2, y]
    }
    return shapeOf(postal)?.centroid
  }
  const tipAt = tip && anchor(tip.race.state)
  const rings = [...new Set([selected, hovered])].flatMap((id) => {
    const k = races.findIndex((race) => race.id === id)
    return k === -1 ? [] : [races[k].state]
  })

  return (
    <section className="map">
      <div className="map-frame">
        <svg
          className="map-svg"
          viewBox={`0 0 ${ATLAS_WIDTH} ${ATLAS_HEIGHT}`}
          role="group"
          aria-label={t('map.senate')}
          onClick={() => onSelect(undefined)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onSelect(undefined)
          }}
        >
          <defs>
            <pattern id={hatch} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect className="map-hatch-stripe" width="2" height="6" />
            </pattern>
          </defs>

          {atlas.states.map((shape) => {
            const k = raceIndex.get(shape.postal)
            if (k === undefined) {
              return <path key={shape.postal} className="map-state map-no-race" d={shape.d} aria-hidden="true" />
            }
            const { race, rating, name, ratingText, margin } = describe(k)
            return (
              <g key={shape.postal}>
                <path
                  className={`map-state map-race ${ratingClass(rating)}`}
                  d={shape.d}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selected === race.id}
                  aria-label={`${name}: ${ratingText}, ${margin}`}
                  {...hover(race.id)}
                  onFocus={(event: FocusEvent<SVGPathElement>) => {
                    // A click focuses the state too: only the keyboard counts as hovering.
                    if (event.currentTarget.matches(':focus-visible')) setHovered(race.id)
                  }}
                  onBlur={() => setHovered((current) => (current === race.id ? undefined : current))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(selected === race.id ? undefined : race.id)
                    }
                  }}
                />
                {race.fixedWinner !== undefined && (
                  <path className="map-hatch" d={shape.d} fill={`url(#${hatch})`} aria-hidden="true" />
                )}
              </g>
            )
          })}

          {SMALL_STATES.map((postal, index) => {
            const { x, y } = squareAt(index)
            const k = raceIndex.get(postal)
            const rating = k === undefined ? undefined : describe(k).rating
            const race = k === undefined ? undefined : races[k]
            return (
              <g
                key={postal}
                className={`map-square ${rating ? `map-race ${ratingClass(rating)}` : 'map-no-race'}`}
                aria-hidden="true"
                {...(race && hover(race.id))}
              >
                <rect className="map-state" x={x} y={y} width={SQUARE} height={SQUARE} />
                {race?.fixedWinner !== undefined && (
                  <rect x={x} y={y} width={SQUARE} height={SQUARE} fill={`url(#${hatch})`} />
                )}
                <text x={x + SQUARE / 2} y={y + SQUARE / 2}>
                  {postal}
                </text>
              </g>
            )
          })}

          {/* Drawn last, so no neighbour covers the outline. */}
          {rings.map((postal) => {
            const small = SMALL_STATES.indexOf(postal)
            const square = small === -1 ? undefined : squareAt(small)
            return (
              <g key={postal} className="map-ring" aria-hidden="true">
                <path d={shapeOf(postal)?.d} />
                {square && <rect x={square.x} y={square.y} width={SQUARE} height={SQUARE} />}
              </g>
            )
          })}
        </svg>

        {tip && tipAt && (
          <div
            className={`map-tooltip${tipAt[1] < ATLAS_HEIGHT / 3 ? ' map-tooltip-below' : ''}`}
            style={{ '--x': tipAt[0] / ATLAS_WIDTH, '--y': tipAt[1] / ATLAS_HEIGHT } as CSSProperties}
            aria-hidden="true"
          >
            <strong>{tip.name}</strong>
            <span>
              {tip.ratingText} · {tip.margin}
            </span>
            <span>{t('map.chance', { party: tip.rating.party, chance: formatProbability(lang, tip.chance) })}</span>
          </div>
        )}
      </div>

      <ul className="map-legend">
        <li>
          <span className="map-swatch map-no-race" />
          {t('map.noRace.senate')}
        </li>
        {hasFixed && (
          <li>
            <span className="map-swatch map-swatch-fixed" />
            {t('map.fixed')}
          </li>
        )}
      </ul>
      <p className="map-hint">{t('map.hint.senate')}</p>
    </section>
  )
}
