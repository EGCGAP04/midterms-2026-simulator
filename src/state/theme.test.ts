import { describe, expect, it } from 'vitest'
import { parseTheme } from './theme.ts'

describe('parseTheme', () => {
  it('reads a stored theme', () => {
    expect(parseTheme('light')).toBe('light')
    expect(parseTheme('dark')).toBe('dark')
  })

  it.each([null, '', 'Dark', 'auto'])('ignores %s', (value) => {
    expect(parseTheme(value)).toBeUndefined()
  })
})
