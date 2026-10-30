// Times the Monte Carlo against the < 50 ms budget (docs/SPEC.md §5). Local
// only, not run in CI: `npm run bench`.

import { readFileSync } from 'node:fs'
import { ENV_MAX, ENV_MIN } from '../src/model/config.ts'
import { createSimulator, simulate } from '../src/model/simulate.ts'
import type { Chamber, Dataset } from '../src/model/types.ts'

const BUDGET_MS = 50
const MOVES = 100

const dataset = JSON.parse(readFileSync(new URL('../public/races.json', import.meta.url), 'utf8')) as Dataset

let start = performance.now()
const simulator = createSimulator(dataset.races)
console.log(`Drawing the errors (once, at startup): ${(performance.now() - start).toFixed(1)} ms`)

for (const chamber of ['house', 'senate'] as Chamber[]) {
  const notUp = chamber === 'senate' ? dataset.senateNotUp : {}
  const times: number[] = []
  for (let i = 0; i < MOVES; i++) {
    const env = ENV_MIN + ((ENV_MAX - ENV_MIN) * i) / (MOVES - 1)
    start = performance.now()
    simulate(simulator, chamber, env - dataset.g0, notUp)
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  const median = times[Math.floor(MOVES / 2)]
  const worst = times[MOVES - 1]
  const verdict = worst < BUDGET_MS ? 'within' : 'OVER'
  console.log(
    `${chamber}: median ${median.toFixed(1)} ms, worst ${worst.toFixed(1)} ms over ${MOVES} slider moves (${verdict} the ${BUDGET_MS} ms budget)`,
  )
}
