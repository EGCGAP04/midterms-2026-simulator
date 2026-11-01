import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import type { Dataset } from '../model/types.ts'
import { normalize, searchEntry, searchRaces } from './search.ts'

const dataset = raw as unknown as Dataset
const house = dataset.races.filter((race) => race.chamber === 'house')
const senate = dataset.races.filter((race) => race.chamber === 'senate')
const houseEntries = house.map(searchEntry)
const senateEntries = senate.map(searchEntry)

const find = (query: string) => searchRaces(houseEntries, query).map((k) => house[k].id)
const findSenate = (query: string) => searchRaces(senateEntries, query).map((k) => senate[k].id)

describe('normalize', () => {
  it('drops case, accents and punctuation, and splits letters from digits', () => {
    expect(normalize('CA-22')).toBe('ca 22')
    expect(normalize('ca22')).toBe('ca 22')
    expect(normalize('  Míchigan,  07 ')).toBe('michigan 07')
  })
})

describe('searchRaces', () => {
  it('finds a district by its code in any spelling', () => {
    for (const query of ['CA-22', 'ca22', 'CA 22', 'ca-022']) expect(find(query)[0], query).toBe('CA-22')
    expect(find('TX 7')).toEqual(['TX-07'])
  })

  it('finds a district by state and number, in either language', () => {
    expect(find('Texas 7')).toEqual(['TX-07'])
    expect(find('nueva york 17')).toEqual(['NY-17'])
    expect(find('New York 17')).toEqual(['NY-17'])
  })

  it('finds an at-large seat as district 1 or AL', () => {
    expect(find('AK 1')).toEqual(['AK-AL'])
    // AL-07 matches too (Alabama, and a candidate whose name starts with Ak).
    expect(find('ak al')[0]).toBe('AK-AL')
  })

  it('puts an exact postal code ahead of a word that only starts the same way', () => {
    const results = find('CA 1')
    expect(results[0]).toBe('CA-01')
    expect(results).toContain('NC-01')
  })

  it('finds a race by a candidate', () => {
    expect(find('valadao')).toEqual(['CA-22'])
    expect(find('Lawler')).toEqual(['NY-17'])
    expect(findSenate('ossoff')).toEqual(['GA-SEN'])
  })

  it('lists a state’s districts, at most 8', () => {
    const results = find('california')
    expect(results).toHaveLength(8)
    expect(results.every((id) => id.startsWith('CA-'))).toBe(true)
  })

  it('finds a Senate race by state, and a special election by that word', () => {
    expect(findSenate('ohio')).toEqual(['OH-SEN'])
    expect(findSenate('especial')).toEqual(['FL-SEN', 'OH-SEN'])
  })

  it('needs every word to match', () => {
    expect(find('texas 99')).toEqual([])
    expect(find('valadao texas')).toEqual([])
    expect(find('   ')).toEqual([])
  })
})
