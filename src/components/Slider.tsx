// The national-environment slider (docs/SPEC.md §4.2): 0.01-point steps when
// dragged, 0.1 or 1 point with the arrow keys (left and right from anywhere on
// the page).

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin } from '../i18n/format.ts'
import type { Lang } from '../i18n/i18n.ts'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN, ENV_STEP, PAST_ENVS } from '../model/config.ts'
import { ARROW_CONTROLS, arrowStep, pageArrowStep, roundEnv, tintAt, trackStops } from '../state/env.ts'

interface SliderProps {
  env: number
  onChange: (env: number) => void
  /** Moves the slider by a step from its latest value (keys can repeat
   * faster than the page renders). */
  onStep: (step: number) => void
}

/** A fraction in points, exact for the slider's steps (−0.0875 → −8.75). */
function toPoints(value: number): number {
  return Math.round(value * 10_000) / 100
}

/** Where a value sits along the slider, from 0 (left) to 1 (right). */
function position(value: number): number {
  return (value - ENV_MIN) / (ENV_MAX - ENV_MIN)
}

/** A labelled mark above the track. */
interface MarkLabel {
  at: number
  text: string
  /** On narrow screens. */
  short: string
  /** Its value, for the tooltip and screen readers. */
  value: string
  /** On narrow screens, the labels alternate between two rows. */
  row: number
}

/** "2018" → "’18". */
const shortYear = (year: number) => `’${String(year).slice(-2)}`

/** Even and the past environments, labelled. Years less than half a point
 * apart share a label (2022 and 2024). */
function markLabels(lang: Lang, even: string): MarkLabel[] {
  const groups: { year: number; env: number }[][] = []
  for (const past of [...PAST_ENVS].sort((a, b) => a.env - b.env)) {
    const last = groups.at(-1)
    if (last && Math.abs(last[0].env - past.env) < 0.005) last.push(past)
    else groups.push([past])
  }
  const labels = groups.map((group) => {
    const byYear = group.toSorted((a, b) => a.year - b.year)
    return {
      at: group.reduce((sum, { env }) => sum + env, 0) / group.length,
      text: byYear.map(({ year }) => year).join(' · '),
      short: byYear.map(({ year }) => shortYear(year)).join('/'),
      value: byYear.map(({ year, env }) => `${year}: ${formatMargin(lang, env)}`).join(', '),
    }
  })
  labels.push({ at: 0, text: even, short: even, value: even })
  return labels.sort((a, b) => a.at - b.at).map((label, k) => ({ ...label, row: k % 2 }))
}

/** The track: each rating's colour at its margin, mixed in OKLCH between. */
const TRACK = `linear-gradient(in oklch to right, ${trackStops().join(', ')})`

export function Slider({ env, onChange, onStep }: SliderProps) {
  const { lang, t } = useI18n()
  const id = useId()
  const value = formatMargin(lang, env)
  const defaultValue = formatMargin(lang, DEFAULT_ENV)
  const track = { '--default': position(DEFAULT_ENV), '--track': TRACK } as CSSProperties
  // The value takes the track's colour at the same point.
  const { lo, hi, mix } = tintAt(env)
  const tint = { '--lo': `var(${lo})`, '--hi': `var(${hi})`, '--mix': mix } as CSSProperties
  const labels = markLabels(lang, t('slider.even'))
  const at = (value: number) => ({ '--at': position(value) }) as CSSProperties

  // Left and right move the slider from anywhere on the page. On the window,
  // so the slider's own handler (and any other) runs first.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const step = pageArrowStep(event)
      if (step === undefined) return
      if (event.target instanceof Element && event.target.closest(ARROW_CONTROLS)) return
      event.preventDefault()
      onStep(step)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onStep])

  // A finger that lands on the track to scroll the page: Chrome moves the
  // value to it first, then hands the gesture to the page (pointercancel).
  // Put the value back, so scrolling past the slider does not change it.
  const touchedAt = useRef<number>(undefined)

  return (
    <section className="slider">
      <div className="slider-heading">
        <label htmlFor={id}>{t('slider.label')}</label>
        <output htmlFor={id} className="slider-value" style={tint}>
          {value}
        </output>
      </div>
      <div className="slider-marks" aria-hidden="true">
        {labels.map((label) => (
          <span key={label.text} className="slider-mark-label" data-row={label.row} style={at(label.at)} title={label.value}>
            <span className="slider-mark-full">{label.text}</span>
            <span className="slider-mark-short">{label.short}</span>
          </span>
        ))}
      </div>
      <div className="slider-track" style={track}>
        {/* Before the input, so the thumb covers them. */}
        {[0, ...PAST_ENVS.map(({ env }) => env)].map((value) => (
          <span key={value} className="slider-mark" style={at(value)} />
        ))}
        <span className="slider-default" title={t('slider.default', { value: defaultValue })} />
        <input
          id={id}
          aria-describedby={`${id}-marks`}
          type="range"
          min={toPoints(ENV_MIN)}
          max={toPoints(ENV_MAX)}
          step={toPoints(ENV_STEP)}
          value={toPoints(env)}
          aria-valuetext={value}
          onChange={(event) => onChange(roundEnv(event.currentTarget.valueAsNumber / 100))}
          onPointerDown={(event) => {
            touchedAt.current = event.pointerType === 'mouse' ? undefined : env
          }}
          onPointerUp={() => {
            touchedAt.current = undefined
          }}
          onPointerCancel={() => {
            if (touchedAt.current !== undefined) onChange(touchedAt.current)
            touchedAt.current = undefined
          }}
          onKeyDown={(event) => {
            const step = arrowStep(event)
            if (step === undefined) return
            event.preventDefault()
            onStep(step)
          }}
        />
      </div>
      <p id={`${id}-marks`} className="visually-hidden">
        {t('slider.marks', { marks: labels.map(({ value }) => value).join('; ') })}
      </p>
      <div className="slider-scale" style={track}>
        <span>{formatMargin(lang, ENV_MIN, { decimals: 0 })}</span>
        <span className="slider-default-label">{t('slider.default', { value: defaultValue })}</span>
        <span>{formatMargin(lang, ENV_MAX, { decimals: 0 })}</span>
      </div>
      <button type="button" className="slider-reset" disabled={env === DEFAULT_ENV} onClick={() => onChange(DEFAULT_ENV)}>
        {t('slider.reset', { value: defaultValue })}
      </button>
    </section>
  )
}
