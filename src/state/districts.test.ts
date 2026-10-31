import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import topology from '../../public/us-house-districts-2026.json'
import type { Dataset } from '../model/types.ts'
import { ATLAS_HEIGHT, ATLAS_WIDTH } from './atlas.ts'
import { districtMap, type DistrictsTopology } from './districts.ts'

const dataset = raw as unknown as Dataset
const map = districtMap(topology as unknown as DistrictsTopology)

describe('districtMap', () => {
  it('has one district for every House race and no other', () => {
    const ids = map.districts.map((district) => district.id)
    const races = dataset.races.filter((race) => race.chamber === 'house').map((race) => race.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual(races.sort())
  })

  it('draws every district, with its centroid inside the map', () => {
    for (const { id, d, centroid } of map.districts) {
      expect(d, id).toMatch(/^M/)
      expect(centroid[0], id).toBeGreaterThan(0)
      expect(centroid[0], id).toBeLessThan(ATLAS_WIDTH)
      expect(centroid[1], id).toBeGreaterThan(0)
      expect(centroid[1], id).toBeLessThan(ATLAS_HEIGHT)
    }
  })

  it('draws the state borders', () => {
    expect(map.borders).toMatch(/^M/)
  })

  it('has the states of every district', () => {
    const states = new Set(topology.objects.states.geometries.map((state) => state.properties.state))
    for (const district of topology.objects.districts.geometries) {
      expect(states.has(district.properties.state), district.properties.id).toBe(true)
      expect(district.properties.id.startsWith(`${district.properties.state}-`), district.properties.id).toBe(true)
    }
  })
})
