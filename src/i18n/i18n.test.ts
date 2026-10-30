import { describe, expect, it } from 'vitest'
import en from './en.json'
import es from './es.json'
import { formatMargin, formatProbability } from './format.ts'
import { CATALOGS, translate, type Catalog, type MessageKey } from './i18n.ts'

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

describe('the catalogs', () => {
  it('have the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('have the same placeholders in every string', () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(placeholders((es as Catalog)[key] ?? ''), key).toEqual(placeholders(en[key]))
    }
  })

  it('have no empty strings', () => {
    for (const text of [...Object.values(en), ...Object.values(es)]) expect(text.trim()).not.toBe('')
  })
})

describe('translate', () => {
  it('looks a string up in the language asked for', () => {
    expect(translate('en', 'chamber.senate')).toBe('Senate')
    expect(translate('es', 'chamber.senate')).toBe('Senado')
  })

  it('keeps the app name in both languages', () => {
    expect(translate('es', 'app.title')).toBe(translate('en', 'app.title'))
  })

  it('fills in placeholders', () => {
    expect(translate('en', 'slider.reset', { value: 'D+8.75' })).toBe('Reset to default (D+8.75)')
  })

  it('falls back to English when a Spanish string is missing', () => {
    const saved = CATALOGS.es['chamber.house']
    delete CATALOGS.es['chamber.house']
    try {
      expect(translate('es', 'chamber.house')).toBe('House')
    } finally {
      CATALOGS.es['chamber.house'] = saved
    }
  })

  it('leaves a placeholder without a value as it is', () => {
    expect(translate('en', 'slider.reset')).toBe('Reset to default ({value})')
  })
})

describe('formatMargin', () => {
  it.each([
    ['en', -0.0875, 'D+8.75'],
    ['es', -0.0875, 'D+8,75'],
    ['en', 0.1, 'R+10.00'],
    ['en', 0.0001, 'R+0.01'],
    ['en', 0, 'EVEN'],
    ['es', 0, 'Empate'],
    ['en', -0.00004, 'EVEN'],
  ] as const)('%s %f is %s', (lang, margin, text) => {
    expect(formatMargin(lang, margin)).toBe(text)
  })

  it('names an independent ahead', () => {
    expect(formatMargin('en', -0.031, { ahead: 'I' })).toBe('I+3.10')
  })

  it('drops the decimals when asked', () => {
    expect(formatMargin('en', -0.29, { decimals: 0 })).toBe('D+29')
    expect(formatMargin('es', 0.2, { decimals: 0 })).toBe('R+20')
  })
})

describe('formatProbability', () => {
  it.each([
    ['en', 1, '>99%'],
    ['en', 0.995, '>99%'],
    ['en', 0.99, '99%'],
    ['en', 0.5, '50%'],
    ['en', 0.01, '1%'],
    ['en', 0.0099, '<1%'],
    ['es', 0, '<1%'],
  ] as const)('%s %f is %s', (lang, probability, text) => {
    expect(formatProbability(lang, probability)).toBe(text)
  })
})
