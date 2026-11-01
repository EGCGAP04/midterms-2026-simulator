// The national-environment slider (docs/SPEC.md §4.2): 0.01-point steps when
// dragged, 0.1 or 1 point with the arrow keys (left and right from anywhere on
// the page).

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin } from '../i18n/format.ts'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN, ENV_STEP } from '../model/config.ts'
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
      <div className="slider-track" style={track}>
        <input
          id={id}
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
        <span className="slider-default" title={t('slider.default', { value: defaultValue })} />
      </div>
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
