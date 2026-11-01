// A chamber at the slider's environment and the local shifts: who leads each
// race (docs/SPEC.md §3.1, §3.5) and the simulated chances (§3.3), shared by
// the summary bar and the map.

import { useMemo } from 'react'
import { adjustRaces, type Adjustments } from '../model/adjust.ts'
import { deltaFrom, outcomeAt, type Outcome } from '../model/margin.ts'
import type { SeatTotals } from '../model/seats.ts'
import { simulate, type ChamberForecast, type Simulator } from '../model/simulate.ts'
import type { Chamber, Dataset, Race, Senator } from '../model/types.ts'

export interface ChamberView {
  chamber: Chamber
  /** The chamber's races, with their local shifts. */
  races: readonly Race[]
  /** `outcomes[k]` is the outcome of `races[k]`. */
  outcomes: readonly Outcome[]
  forecast: ChamberForecast
  /** The Senate seats not up for election; empty for the House. */
  notUp: Partial<SeatTotals>
  /** The senators not up for election; empty for the House. */
  senatorsNotUp: readonly Senator[]
  /** How many simulations the chances come from. */
  sims: number
}

const NONE: Partial<SeatTotals> = {}
const NO_SENATORS: readonly Senator[] = []

export function useChamberView(
  dataset: Dataset,
  simulator: Simulator,
  chamber: Chamber,
  env: number,
  adjustments: Adjustments,
): ChamberView {
  const notUp = chamber === 'senate' ? dataset.senateNotUp : NONE
  const delta = deltaFrom(env, dataset.g0)

  // The shifted races replace the simulator's: same order, so each keeps its
  // drawn errors (§3.5).
  const adjusted = useMemo(() => {
    const all = adjustRaces(simulator.races, adjustments)
    return all === simulator.races ? simulator : { ...simulator, races: all }
  }, [simulator, adjustments])
  const races = useMemo(() => adjusted.races.filter((race) => race.chamber === chamber), [adjusted, chamber])
  const outcomes = useMemo(() => races.map((race) => outcomeAt(race, delta)), [races, delta])
  const forecast = useMemo(() => simulate(adjusted, chamber, delta, notUp), [adjusted, chamber, delta, notUp])

  const senatorsNotUp = chamber === 'senate' ? dataset.senatorsNotUp : NO_SENATORS
  return { chamber, races, outcomes, forecast, notUp, senatorsNotUp, sims: simulator.n }
}
