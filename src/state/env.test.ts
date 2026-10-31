import { describe, expect, it } from 'vitest'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN } from '../model/config.ts'
import { arrowStep, pageArrowStep, roundEnv, stepEnv, tintAt, trackStops } from './env.ts'

const key = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...modifiers,
})

describe('roundEnv', () => {
  it('rounds to 0.01 points', () => {
    expect(roundEnv(-0.087_54)).toBe(-0.0875)
    expect(roundEnv(0.000_06)).toBe(0.0001)
  })
})

describe('arrowStep', () => {
  it.each([
    ['ArrowRight', 0.001],
    ['ArrowUp', 0.001],
    ['ArrowLeft', -0.001],
    ['ArrowDown', -0.001],
  ])('moves %s by 0.1 points', (name, step) => {
    expect(arrowStep(key(name))).toBe(step)
  })

  it('moves by 1 point with Shift', () => {
    expect(arrowStep(key('ArrowRight', { shiftKey: true }))).toBe(0.01)
    expect(arrowStep(key('ArrowDown', { shiftKey: true }))).toBe(-0.01)
  })

  it.each(['PageUp', 'Home', 'a', 'toString', 'constructor'])('leaves %s to the browser', (name) => {
    expect(arrowStep(key(name))).toBeUndefined()
  })

  it.each(['altKey', 'ctrlKey', 'metaKey'])('leaves an arrow with %s to the browser', (modifier) => {
    expect(arrowStep(key('ArrowLeft', { [modifier]: true }))).toBeUndefined()
  })
})

describe('pageArrowStep', () => {
  const pageKey = (name: string, modifiers: Partial<KeyboardEvent> = {}) => ({ ...key(name), defaultPrevented: false, ...modifiers })

  it('moves the slider with left and right, by 1 point with Shift', () => {
    expect(pageArrowStep(pageKey('ArrowRight'))).toBe(0.001)
    expect(pageArrowStep(pageKey('ArrowLeft'))).toBe(-0.001)
    expect(pageArrowStep(pageKey('ArrowLeft', { shiftKey: true }))).toBe(-0.01)
  })

  it.each(['ArrowUp', 'ArrowDown', 'PageUp', 'Home', 'a'])('leaves %s to the page', (name) => {
    expect(pageArrowStep(pageKey(name))).toBeUndefined()
  })

  it('leaves a key that something else handled', () => {
    expect(pageArrowStep(pageKey('ArrowRight', { defaultPrevented: true }))).toBeUndefined()
  })

  it.each(['altKey', 'ctrlKey', 'metaKey'])('leaves an arrow with %s to the browser', (modifier) => {
    expect(pageArrowStep(pageKey('ArrowRight', { [modifier]: true }))).toBeUndefined()
  })
})

describe('stepEnv', () => {
  it('moves from the current value without snapping, and back', () => {
    expect(stepEnv(DEFAULT_ENV, 0.001)).toBe(-0.0865)
    expect(stepEnv(stepEnv(DEFAULT_ENV, 0.001), -0.001)).toBe(DEFAULT_ENV)
    expect(stepEnv(DEFAULT_ENV, -0.01)).toBe(-0.0975)
  })

  it('stays exact over many steps', () => {
    let env = ENV_MIN
    for (let i = 0; i < 490; i++) env = stepEnv(env, 0.001)
    expect(env).toBe(ENV_MAX)
  })

  it('stops at the ends of the range', () => {
    expect(stepEnv(ENV_MAX - 0.0005, 0.01)).toBe(ENV_MAX)
    expect(stepEnv(ENV_MIN, -0.001)).toBe(ENV_MIN)
  })
})

describe('tintAt', () => {
  it.each([
    [0, '--color-even', '--r-tilt', 0],
    [-0.01, '--color-even', '--d-tilt', 0.5],
    [-0.02, '--color-even', '--d-tilt', 1],
    [0.03, '--r-tilt', '--r-lean', 0.5],
    [-0.0875, '--d-likely', '--d-safe', 0.09375],
    [0.16, '--r-likely', '--r-safe', 1],
    [-0.29, '--d-safe', '--d-safe', 1],
  ])('%f mixes %s into %s by %f', (env, lo, hi, mix) => {
    const tint = tintAt(env)
    expect(tint).toMatchObject({ lo, hi })
    expect(tint.mix).toBeCloseTo(mix, 9)
  })

  it('only grows toward each end', () => {
    let previous = -1
    for (let points = 0; points <= 20; points += 0.01) {
      const { lo, hi, mix } = tintAt(points / 100)
      const step = ['--color-even', '--r-tilt', '--r-lean', '--r-likely', '--r-safe'].indexOf(lo) + (hi === lo ? 0 : mix)
      expect(step).toBeGreaterThanOrEqual(previous)
      previous = step
    }
  })
})

describe('trackStops', () => {
  it('places each rating colour at its margin, from Safe D to Safe R', () => {
    const at = (env: number) => `${(((env - ENV_MIN) / (ENV_MAX - ENV_MIN)) * 100).toFixed(2)}%`
    expect(trackStops()).toEqual([
      `var(--d-safe) ${at(-0.16)}`,
      `var(--d-likely) ${at(-0.08)}`,
      `var(--d-lean) ${at(-0.04)}`,
      `var(--d-tilt) ${at(-0.02)}`,
      `var(--color-even) ${at(0)}`,
      `var(--r-tilt) ${at(0.02)}`,
      `var(--r-lean) ${at(0.04)}`,
      `var(--r-likely) ${at(0.08)}`,
      `var(--r-safe) ${at(0.16)}`,
    ])
  })
})
