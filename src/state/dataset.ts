// Loads races.json once and draws the simulation errors (docs/SPEC.md §3.3).

import { useEffect, useState } from 'react'
import { createSimulator, type Simulator } from '../model/simulate.ts'
import type { Dataset } from '../model/types.ts'

export type DatasetState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; dataset: Dataset; simulator: Simulator }

export function useDataset(): DatasetState {
  const [state, setState] = useState<DatasetState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}races.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`races.json: HTTP ${response.status}`)
        return response.json() as Promise<Dataset>
      })
      .then((dataset) => {
        if (!cancelled) setState({ status: 'ready', dataset, simulator: createSimulator(dataset.races) })
      })
      .catch((error: unknown) => {
        console.error(error)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
