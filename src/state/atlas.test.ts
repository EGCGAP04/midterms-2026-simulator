import { describe, expect, it } from 'vitest'
import raw from '../../public/races.json'
import topology from 'us-atlas/states-albers-10m.json'
import { CATALOGS, type MessageKey } from '../i18n/i18n.ts'
import { POSTAL_BY_FIPS } from '../model/states.ts'
import type { Dataset } from '../model/types.ts'
import { ATLAS_HEIGHT, ATLAS_WIDTH, stateShapes, type StatesTopology } from './atlas.ts'

const dataset = raw as unknown as Dataset
const shapes = stateShapes(topology as unknown as StatesTopology)

describe('stateShapes', () => {
  it('draws every state and DC once', () => {
    const postals = shapes.map((shape) => shape.postal)
    expect(new Set(postals).size).toBe(51)
    expect(postals.sort()).toEqual(Object.values(POSTAL_BY_FIPS).sort())
  })

  it('gives every state an outline and a centroid inside the map', () => {
    for (const { postal, d, centroid } of shapes) {
      expect(d, postal).toMatch(/^M/)
      expect(centroid[0], postal).toBeGreaterThan(0)
      expect(centroid[0], postal).toBeLessThan(ATLAS_WIDTH)
      expect(centroid[1], postal).toBeGreaterThan(0)
      expect(centroid[1], postal).toBeLessThan(ATLAS_HEIGHT)
    }
  })

  it('has a state for every race', () => {
    const postals = new Set(shapes.map((shape) => shape.postal))
    for (const race of dataset.races) expect(postals.has(race.state), race.id).toBe(true)
  })

  it('has one Senate race at most per state', () => {
    const states = dataset.races.filter((race) => race.chamber === 'senate').map((race) => race.state)
    expect(new Set(states).size).toBe(states.length)
  })
})

describe('state names', () => {
  it('exist in both languages for every state', () => {
    for (const postal of Object.values(POSTAL_BY_FIPS)) {
      const key = `state.${postal}` as MessageKey
      expect(CATALOGS.en[key], postal).toBeDefined()
      expect(CATALOGS.es[key], postal).toBeDefined()
    }
  })
})
