import { describe, expect, it } from 'vitest'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN } from '../model/config.ts'
import { arrowStep, roundEnv, stepEnv } from './env.ts'

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
