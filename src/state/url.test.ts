import { describe, expect, it } from 'vitest'
import { DEFAULT_ENV, ENV_MAX, ENV_MIN } from '../model/config.ts'
import { roundEnv } from './env.ts'
import { browserLang, readUrlState, writeUrlState } from './url.ts'

describe('readUrlState', () => {
  it('reads every value', () => {
    expect(readUrlState('?ch=senate&env=-5.25&lang=es', ['en-US'])).toEqual({
      chamber: 'senate',
      env: -0.0525,
      lang: 'es',
    })
  })

  it('defaults to the House, DEFAULT_ENV and the browser language', () => {
    expect(readUrlState('', ['es-AR', 'en'])).toEqual({ chamber: 'house', env: DEFAULT_ENV, lang: 'es' })
    expect(readUrlState('', [])).toEqual({ chamber: 'house', env: DEFAULT_ENV, lang: 'en' })
  })

  it.each(['abc', '', '1e2', '--3', '5%', 'NaN', 'Infinity', '-29.01', '20.5'])('ignores env=%s', (env) => {
    expect(readUrlState(`?env=${encodeURIComponent(env)}`, []).env).toBe(DEFAULT_ENV)
  })

  it.each([
    ['3', 0.03],
    ['+3', 0.03],
    ['.5', 0.005],
    ['-29', ENV_MIN],
    ['20', ENV_MAX],
    ['0', 0],
    ['-8.756', -0.0876],
  ])('reads env=%s as %f', (env, value) => {
    expect(readUrlState(`?env=${encodeURIComponent(env)}`, []).env).toBe(value)
  })

  it('ignores an unknown chamber or language', () => {
    expect(readUrlState('?ch=assembly&lang=fr', ['es'])).toMatchObject({ chamber: 'house', lang: 'es' })
  })
})

describe('writeUrlState', () => {
  it('writes env in points with two decimals', () => {
    expect(writeUrlState({ chamber: 'house', env: -0.0875, lang: 'es' }, ['en'])).toBe('?ch=house&env=-8.75&lang=es')
    expect(writeUrlState({ chamber: 'senate', env: 0.2, lang: 'en' }, ['es'])).toBe('?ch=senate&env=20.00&lang=en')
  })

  it('writes an even environment as 0.00, never -0.00', () => {
    expect(writeUrlState({ chamber: 'house', env: -0.000001, lang: 'en' }, [])).toBe('?ch=house&env=0.00')
  })

  it('leaves out the language when it matches the browser', () => {
    expect(writeUrlState({ chamber: 'house', env: -0.0875, lang: 'es' }, ['es-AR'])).toBe('?ch=house&env=-8.75')
    expect(writeUrlState({ chamber: 'house', env: -0.0875, lang: 'en' }, [])).toBe('?ch=house&env=-8.75')
  })

  it('opens a link without a language in the reader’s language', () => {
    const link = writeUrlState({ chamber: 'house', env: 0, lang: 'es' }, ['es'])
    expect(readUrlState(link, ['en-US']).lang).toBe('en')
  })

  it('reads back every slider step it writes', () => {
    for (let hundredths = ENV_MIN * 10_000; hundredths <= ENV_MAX * 10_000; hundredths += 1) {
      const state = { chamber: 'senate', env: roundEnv(hundredths / 10_000), lang: 'es' } as const
      expect(readUrlState(writeUrlState(state, ['en']), ['en'])).toEqual(state)
      expect(readUrlState(writeUrlState(state, ['es']), ['es'])).toEqual(state)
    }
  })
})

describe('browserLang', () => {
  it.each([
    [['es'], 'es'],
    [['ES-mx', 'en'], 'es'],
    [['en-GB', 'es'], 'en'],
    [['pt-BR'], 'en'],
  ] as const)('%j is %s', (languages, lang) => {
    expect(browserLang(languages)).toBe(lang)
  })
})
