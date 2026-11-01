// Local adjustments (docs/SPEC.md §4.10): shift a state or a House district
// toward D or R, before the slider (§3.5).

import { useMemo, type CSSProperties } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin, raceName, stateName } from '../i18n/format.ts'
import type { Lang } from '../i18n/i18n.ts'
import { adjustmentOrder, clampShift, isStateKey, type Adjustments } from '../model/adjust.ts'
import { ADJ_MAX, ADJ_STEP } from '../model/config.ts'
import type { Chamber, Race } from '../model/types.ts'
import { candidateList, searchEntry, stateSearchEntry } from '../state/search.ts'
import { SearchBox } from './SearchBox.tsx'

interface AdjustPanelProps {
  chamber: Chamber
  /** Every race of both chambers, unadjusted: the states and districts. */
  races: readonly Race[]
  /** The race selected on the map or in the lists, if any. */
  selected: Race | undefined
  adjustments: Adjustments
  onChange: (adjustments: Adjustments) => void
}

/** A state or a House district that can be shifted. */
interface Target {
  key: string
  name: string
  /** The district's race, for its candidates. */
  race?: Race
}

function targetName(lang: Lang, key: string, races: readonly Race[]): string {
  if (isStateKey(key)) return stateName(lang, key)
  const race = races.find((r) => r.id === key && r.chamber === 'house')
  return race ? raceName(lang, race) : key
}

/** Points, the controls' unit: R − opposition. */
const toPoints = (shift: number) => Math.round(shift * 1000) / 10

export function AdjustPanel({ chamber, races, selected, adjustments, onChange }: AdjustPanelProps) {
  const { lang, t } = useI18n()

  const { states, districts } = useMemo(() => {
    const postals = [...new Set(races.map((race) => race.state))]
    const states: Target[] = postals
      .map((key) => ({ key, name: stateName(lang, key) }))
      .sort((a, b) => a.name.localeCompare(b.name, lang))
    const districts: Target[] = races
      .filter((race) => race.chamber === 'house')
      .map((race) => ({ key: race.id, name: raceName(lang, race), race }))
    return { states, districts }
  }, [races, lang])

  // The Senate only takes states; the House, states and then districts.
  const targets = useMemo(() => (chamber === 'senate' ? states : [...states, ...districts]), [chamber, states, districts])
  const entries = useMemo(
    () => targets.map((target) => (target.race ? searchEntry(target.race) : stateSearchEntry(target.key))),
    [targets],
  )

  // Known keys only: a URL may carry one that matches nothing.
  const known = useMemo(() => new Set([...states, ...districts].map(({ key }) => key)), [states, districts])
  const rows = [...adjustments.keys()].filter((key) => known.has(key)).sort(adjustmentOrder)

  const set = (key: string, shift: number) => onChange(new Map(adjustments).set(key, clampShift(shift)))
  const add = (key: string) => {
    if (!adjustments.has(key)) set(key, 0)
  }
  const remove = (key: string) => {
    const next = new Map(adjustments)
    next.delete(key)
    onChange(next)
  }

  // Shortcuts for the selected race: its state and, in the House, its district.
  const offers = selected
    ? [selected.state, ...(selected.chamber === 'house' ? [selected.id] : [])].filter((key) => !adjustments.has(key))
    : []

  return (
    <section className="adjust" aria-labelledby="adjust-title">
      <h2 id="adjust-title" className="panel-title">
        {t('adjust.title')}
      </h2>
      <p className="adjust-hint">{t('adjust.hint')}</p>

      <SearchBox
        items={targets}
        entries={entries}
        label={t('adjust.search.label')}
        placeholder={t(chamber === 'senate' ? 'adjust.search.placeholder.senate' : 'adjust.search.placeholder.house')}
        itemKey={(target) => target.key}
        renderItem={(target) => (
          <>
            <span className="search-name">
              {target.name} <span className="search-code">{target.key}</span>
            </span>
            {target.race && <span className="search-candidates">{candidateList(target.race)}</span>}
          </>
        )}
        onPick={(target) => add(target.key)}
      />

      {offers.length > 0 && (
        <p className="adjust-offers">
          {offers.map((key) => (
            <button key={key} type="button" className="adjust-offer" onClick={() => add(key)}>
              {t('adjust.add', { name: targetName(lang, key, races) })}
            </button>
          ))}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="adjust-empty">{t('adjust.empty')}</p>
      ) : (
        <>
          <ul className="adjust-list">
            {rows.map((key) => {
              const shift = adjustments.get(key) ?? 0
              const name = targetName(lang, key, races)
              const value = formatMargin(lang, shift, { decimals: 1 })
              const side = shift > 0 ? 'r' : shift < 0 ? 'd' : 'even'
              const id = `adjust-${key}`
              return (
                <li key={key} className="adjust-row">
                  <label className="adjust-name" htmlFor={id}>
                    {name} <span className="search-code">{key}</span>
                  </label>
                  <output className={`adjust-value adjust-value-${side}`} htmlFor={id}>
                    {value}
                  </output>
                  <button
                    type="button"
                    className="adjust-remove"
                    aria-label={t('adjust.remove', { name })}
                    title={t('adjust.remove', { name })}
                    onClick={() => remove(key)}
                  >
                    ×
                  </button>
                  <input
                    id={id}
                    className="adjust-range"
                    type="range"
                    min={-toPoints(ADJ_MAX)}
                    max={toPoints(ADJ_MAX)}
                    step={toPoints(ADJ_STEP)}
                    value={toPoints(shift)}
                    aria-valuetext={value}
                    style={{ '--at': (shift + ADJ_MAX) / (2 * ADJ_MAX) } as CSSProperties}
                    onChange={(event) => set(key, Number(event.target.value) / 100)}
                  />
                </li>
              )
            })}
          </ul>
          <button type="button" className="slider-reset adjust-reset" onClick={() => onChange(new Map())}>
            {t('adjust.resetAll')}
          </button>
        </>
      )}
    </section>
  )
}
