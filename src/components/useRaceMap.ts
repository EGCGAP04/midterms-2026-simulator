// What both maps share (docs/SPEC.md §4.4): each race's description, and the
// hover, focus and selection of races.

import { useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin, raceName } from '../i18n/format.ts'
import { ratingOf, type Rating } from '../model/ratings.ts'
import { independentSide } from '../model/summary.ts'
import type { Race } from '../model/types.ts'
import type { ChamberView } from '../state/forecast.ts'

/** The CSS class that colours a race (shared with the summary bar). */
export function ratingClass(rating: Rating): string {
  return rating.party === 'I' ? 'rating-i' : `rating-${rating.party.toLowerCase()}-${rating.bucket}`
}

export interface RaceDetails {
  race: Race
  rating: Rating
  name: string
  ratingText: string
  margin: string
  /** The leader's chance of winning. */
  chance: number
}

export function useRaceMap(view: ChamberView, selected: string | undefined, onSelect: (id: string | undefined) => void) {
  const { lang, t } = useI18n()
  const [hovered, setHovered] = useState<string>()
  const { races, outcomes, forecast } = view

  const describe = (k: number): RaceDetails => {
    const race = races[k]
    const outcome = outcomes[k]
    const rating = ratingOf(outcome)
    // An independent is named by the party it runs against.
    const ratingText =
      rating.party === 'I'
        ? t('summary.independent', { party: independentSide(race) === 'D' ? 'R' : 'D' })
        : t(`rating.${rating.bucket}`, { party: rating.party })
    return {
      race,
      rating,
      name: raceName(lang, race),
      ratingText,
      margin: formatMargin(lang, outcome.margin, { ahead: outcome.winner }),
      chance: forecast.probabilities.get(race.id)?.[outcome.winner] ?? 0,
    }
  }

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
      'aria-label': `${details.name}: ${details.ratingText}, ${details.margin}`,
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
