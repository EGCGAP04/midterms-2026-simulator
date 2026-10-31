// The national-environment slider (docs/SPEC.md §4.2): 0.01-point steps when
// dragged, 0.1 or 1 point with the arrow keys.

import { useId, type CSSProperties } from 'react'
import { useI18n } from '../i18n/context.ts'
import { formatMargin } from '../i18n/format.ts'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN, ENV_STEP } from '../model/config.ts'
import { arrowStep, roundEnv, stepEnv } from '../state/env.ts'

interface SliderProps {
  env: number
  onChange: (env: number) => void
}

/** A fraction in points, exact for the slider's steps (−0.0875 → −8.75). */
function toPoints(value: number): number {
  return Math.round(value * 10_000) / 100
}

/** Where, between a party's end of the track and EVEN, its colour is half
 * faded: past the middle, so small margins already show colour. */
const TINT_HINT = 0.75
/** The exponent of a CSS colour hint at TINT_HINT. */
const TINT_POWER = Math.log(0.5) / Math.log(TINT_HINT)

/** Where a value sits along the slider, from 0 (left) to 1 (right). */
function position(value: number): number {
  return (value - ENV_MIN) / (ENV_MAX - ENV_MIN)
}

export function Slider({ env, onChange }: SliderProps) {
  const { lang, t } = useI18n()
  const id = useId()
  const value = formatMargin(lang, env)
  const defaultValue = formatMargin(lang, DEFAULT_ENV)
  const side = roundEnv(env) === 0 ? 'even' : env < 0 ? 'd' : 'r'
  const track = { '--default': position(DEFAULT_ENV), '--even': position(0), '--hint': TINT_HINT } as CSSProperties
  // How much party colour the value takes: the track's at the same point,
  // from 0 at EVEN to 1 at the party's end.
  const lean = env < 0 ? env / ENV_MIN : env / ENV_MAX
  const tint = { '--tint': 1 - (1 - lean) ** TINT_POWER } as CSSProperties

  return (
    <section className="slider">
      <div className="slider-heading">
        <label htmlFor={id}>{t('slider.label')}</label>
        <output htmlFor={id} className={`slider-value slider-value-${side}`} style={tint}>
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
          onKeyDown={(event) => {
            const step = arrowStep(event)
            if (step === undefined) return
            event.preventDefault()
            onChange(stepEnv(env, step))
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
