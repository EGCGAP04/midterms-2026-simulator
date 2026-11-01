// What both maps share (docs/SPEC.md §4.4): each race's description, and the
// hover, focus and selection of races.

import { useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin, raceName } from '../i18n/format.ts'
import { translate, type Lang } from '../i18n/i18n.ts'
import { flipOf, type Flip } from '../model/flips.ts'
import type { Outcome } from '../model/margin.ts'
import { ratingOf, type Rating } from '../model/ratings.ts'
import { independentSide } from '../model/summary.ts'
import type { Party, Race } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'
import type { MapColours } from '../state/url.ts'

/** The CSS class that colours a race (shared with the summary bar). */
export function ratingClass(rating: Rating): string {
  return rating.party === 'I' ? 'rating-i' : `rating-${rating.party.toLowerCase()}-${rating.bucket}`
}

/** The winner's colour, dark for a flip and light for a hold (the rating
 * classes' Safe and Tilt): the flip pill and the flips map. */
export function outcomeClass(winner: Party, flip: boolean): string {
  if (winner === 'I') return flip ? 'rating-i' : 'rating-i-light'
  return `rating-${winner.toLowerCase()}-${flip ? 'safe' : 'tilt'}`
}

/** The classes whose fill is light, with dark text: a hatch over them is
 * drawn in dark stripes. */
const LIGHT_FILLS = new Set([
  'rating-d-tilt',
  'rating-d-lean',
  'rating-d-likely',
  'rating-r-tilt',
  'rating-r-lean',
  'rating-i-light',
])

/** How a race is painted on a map: its fill class, and the hatch over a flip. */
export interface RacePaint {
  fill: string
  /** Undefined when the race holds; otherwise the stripes' tone. */
  hatch: 'light' | 'dark' | undefined
}

export function racePaint(details: RaceDetails, colours: MapColours): RacePaint {
  const flip = details.flip !== undefined
  const fill = colours === 'flips' ? outcomeClass(details.outcome.winner, flip) : ratingClass(details.rating)
  return { fill, hatch: flip ? (LIGHT_FILLS.has(fill) ? 'dark' : 'light') : undefined }
}

export interface RaceDetails {
  race: Race
  outcome: Outcome
  rating: Rating
  /** Whether the side ahead is not the party that holds the seat. */
  flip: Flip | undefined
  name: string
  ratingText: string
  /** Undefined for a fixed race, whose ±100 is no real margin. */
  margin: string | undefined
  /** The leader's chance of winning. */
  chance: number
}

/** The `k`-th race of a chamber at the slider, ready to show (the maps'
 * tooltip and the race panel). */
export function raceDetails(lang: Lang, view: ChamberView, k: number): RaceDetails {
  const race = view.races[k]
  const outcome = view.outcomes[k]
  const rating = ratingOf(outcome)
  // An independent is named by the party it runs against.
  const ratingText =
    rating.party === 'I'
      ? translate(lang, 'summary.independent', { party: independentSide(race) === 'D' ? 'R' : 'D' })
      : translate(lang, `rating.${rating.bucket}`, { party: rating.party })
  return {
    race,
    outcome,
    rating,
    flip: flipOf(race, outcome),
    name: raceName(lang, race),
    ratingText,
    margin: race.fixedWinner === undefined ? formatMargin(lang, outcome.margin, { ahead: outcome.winner }) : undefined,
    chance: view.forecast.probabilities.get(race.id)?.[outcome.winner] ?? 0,
  }
}

export function useRaceMap(view: ChamberView, selected: string | undefined, onSelect: (id: string | undefined) => void) {
  const { lang } = useI18n()
  const [hovered, setHovered] = useState<string>()
  const { races } = view

  const describe = (k: number): RaceDetails => raceDetails(lang, view, k)

  const toggle = (id: string) => onSelect(selected === id ? undefined : id)

  // Mouse hover only: a touch also ends with a pointerleave, so a tap selects.
  const pointer = (id: string) => ({
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered(id)
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') setHovered((current) => (current === id ? undefined : current))
    },
    onClick: (event: MouseEvent) => {
      // The map's background clears the selection.
      event.stopPropagation()
      toggle(id)
    },
  })

  /** A race's shape: a button in the Tab order, with the pointer's events. */
  const raceProps = (details: RaceDetails) => {
    const { id } = details.race
    return {
      tabIndex: 0,
      role: 'button',
      // Which race a focus event on the map came from.
      'data-race': id,
      'aria-pressed': selected === id,
      'aria-label': [`${details.name}: ${details.ratingText}`, details.margin].filter(Boolean).join(', '),
      ...pointer(id),
      onFocus: (event: FocusEvent<Element>) => {
        // A click focuses the race too: only the keyboard counts as hovering.
        if (event.currentTarget.matches(':focus-visible')) setHovered(id)
      },
      onBlur: () => setHovered((current) => (current === id ? undefined : current)),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          toggle(id)
        }
      },
    }
  }

  /** The map's own: its background and Escape clear the selection. */
  const mapProps = {
    onClick: () => onSelect(undefined),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSelect(undefined)
    },
  }

  const activeIndex = races.findIndex((race) => race.id === (hovered ?? selected))
  return {
    describe,
    pointer,
    raceProps,
    mapProps,
    /** The race the tooltip shows: the hovered one, or else the selected one. */
    tip: activeIndex === -1 ? undefined : describe(activeIndex),
    /** The races with an outline. */
    ringed: [...new Set([selected, hovered])].filter((id) => id !== undefined),
  }
}
