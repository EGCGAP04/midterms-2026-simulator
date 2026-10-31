// A chamber at the slider's environment: who leads each race (docs/SPEC.md
// §3.1) and the simulated chances (§3.3), shared by the summary bar and the map.

import { useMemo } from 'react'
import { deltaFrom, outcomeAt, type Outcome } from '../model/margin.ts'
import type { SeatTotals } from '../model/seats.ts'
import { simulate, type ChamberForecast, type Simulator } from '../model/simulate.ts'
import type { Chamber, Dataset, Race } from '../model/types.ts'

export interface ChamberView {
  chamber: Chamber
  races: readonly Race[]
  /** `outcomes[k]` is the outcome of `races[k]`. */
  outcomes: readonly Outcome[]
  forecast: ChamberForecast
  /** The Senate seats not up for election; empty for the House. */
  notUp: Partial<SeatTotals>
  /** How many simulations the chances come from. */
  sims: number
}

const NONE: Partial<SeatTotals> = {}

export function useChamberView(dataset: Dataset, simulator: Simulator, chamber: Chamber, env: number): ChamberView {
  const notUp = chamber === 'senate' ? dataset.senateNotUp : NONE
  const delta = deltaFrom(env, dataset.g0)

  const races = useMemo(() => dataset.races.filter((race) => race.chamber === chamber), [dataset, chamber])
  const outcomes = useMemo(() => races.map((race) => outcomeAt(race, delta)), [races, delta])
  const forecast = useMemo(() => simulate(simulator, chamber, delta, notUp), [simulator, chamber, delta, notUp])

  return { chamber, races, outcomes, forecast, notUp, sims: simulator.n }
}
