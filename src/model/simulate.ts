// Monte Carlo with correlated errors (docs/SPEC.md §3.3).

import {
  HOUSE_MAJORITY,
  N_SIMS,
  SEED,
  SENATE_R_CONTROL,
  POLLED_SOURCES,
  SIGMA_NAT,
  SIGMA_RACE_HOUSE,
  SIGMA_RACE_SENATE,
  SIGMA_RACE_SENATE_NOPOLL,
} from './config.ts'
import { outcomeAt } from './margin.ts'
import type { SeatTotals } from './seats.ts'
import type { Chamber, Party, Race } from './types.ts'

const PARTIES: readonly Party[] = ['R', 'D', 'I']

/** A seeded uniform generator on [0, 1) (mulberry32). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fills `out` with Normal(0, sigma) draws (Box–Muller, both values of each pair). */
export function fillNormal(out: Float32Array, sigma: number, random: () => number): void {
  for (let i = 0; i < out.length; i += 2) {
    // 1 − u keeps the logarithm away from 0.
    const radius = sigma * Math.sqrt(-2 * Math.log(1 - random()))
    const angle = 2 * Math.PI * random()
    out[i] = radius * Math.cos(angle)
    if (i + 1 < out.length) out[i + 1] = radius * Math.sin(angle)
  }
}

/** The errors of every simulation, drawn once (common random numbers): moving
 * the slider only re-adds the offset, so the results never jitter. */
export interface Simulator {
  races: readonly Race[]
  n: number
  /** One shared national error per simulation, ε_n. */
  national: Float32Array
  /** One error per race and simulation, ε_r, race by race: race k's errors
   * are `raceErrors[k * n … (k + 1) * n − 1]`. */
  raceErrors: Float32Array
}

/** A race's own error (§3.3): by chamber, and in the Senate by its polling.
 * A `pollSource` other than "Avg" or "CtM" gets the wider sigma. */
export function raceSigma(race: Race): number {
  if (race.chamber === 'house') return SIGMA_RACE_HOUSE
  return race.pollSource !== undefined && POLLED_SOURCES.includes(race.pollSource)
    ? SIGMA_RACE_SENATE
    : SIGMA_RACE_SENATE_NOPOLL
}

/** Draws every error for `races` from one seeded stream: the national errors
 * first, then each race's in order. Both chambers share the national errors. */
export function createSimulator(races: readonly Race[], n = N_SIMS, seed = SEED): Simulator {
  const random = mulberry32(seed)
  const national = new Float32Array(n)
  fillNormal(national, SIGMA_NAT, random)
  const raceErrors = new Float32Array(races.length * n)
  races.forEach((race, k) => {
    fillNormal(raceErrors.subarray(k * n, (k + 1) * n), raceSigma(race), random)
  })
  return { races, n, national, raceErrors }
}

export interface SeatDistribution {
  median: number
  /** The 10th and 90th percentiles. */
  interval80: [number, number]
  /** `histogram[s]`: the simulations in which the party wins `s` seats. */
  histogram: Uint32Array
}

export interface ChamberForecast {
  /** Per race id: the share of simulations each party wins. */
  probabilities: Map<string, Record<Party, number>>
  /** By party: an independent counts as I even when caucusing with one. */
  seats: Record<Party, SeatDistribution>
  /** By bloc: a party's seats plus those of the independents who caucus with
   * it (in the Senate, Sanders and King with D). Control goes by bloc. */
  blocs: Record<Bloc, SeatDistribution>
  control: {
    /** House: R bloc ≥ 218. Senate: R ≥ 50 (the Vice President breaks ties). */
    R: number
    /** House: D bloc ≥ 218 (with other independent winners, neither side
     * may reach it). Senate: the complement of R control, shown as "D + I". */
    opposition: number
  }
}

export type Bloc = 'D' | 'R'

/** The bloc a party's winner in `race` joins: an independent's caucus, if any. */
function blocOf(race: Race, party: Party): Bloc | undefined {
  if (party !== 'I') return party
  return [race.rep, race.opp].find((candidate) => candidate?.party === 'I')?.caucus
}

/** The smallest seat count reached by at least a share `q` of the simulations. */
function quantile(histogram: Uint32Array, n: number, q: number): number {
  let cumulative = 0
  for (let seats = 0; seats < histogram.length; seats++) {
    cumulative += histogram[seats]
    if (cumulative >= q * n) return seats
  }
  return histogram.length - 1
}

function distribution(seats: Uint16Array, total: number): SeatDistribution {
  const histogram = new Uint32Array(total + 1)
  for (const count of seats) histogram[count] += 1
  return {
    median: quantile(histogram, seats.length, 0.5),
    interval80: [quantile(histogram, seats.length, 0.1), quantile(histogram, seats.length, 0.9)],
    histogram,
  }
}

function shareAtLeast(histogram: Uint32Array, seats: number, n: number): number {
  let count = 0
  for (let s = seats; s < histogram.length; s++) count += histogram[s]
  return count / n
}

/** Simulates one chamber with the slider Δ away from the workbook baseline.
 * `notUp` adds the Senate seats not up for election. */
export function simulate(
  simulator: Simulator,
  chamber: Chamber,
  delta: number,
  notUp: Partial<SeatTotals> = {},
): ChamberForecast {
  const { races, n, national, raceErrors } = simulator
  const seats: Record<Party, Uint16Array> = {
    R: new Uint16Array(n).fill(notUp.R ?? 0),
    D: new Uint16Array(n).fill(notUp.D ?? 0),
    I: new Uint16Array(n).fill(notUp.I ?? 0),
  }
  // The independents not up (Sanders and King) caucus with D (§2.4).
  const blocSeats: Record<Bloc, Uint16Array> = {
    R: new Uint16Array(n).fill(notUp.R ?? 0),
    D: new Uint16Array(n).fill((notUp.D ?? 0) + (notUp.I ?? 0)),
  }
  /** Where the wins of independents with no caucus are counted, unread. */
  const scratch = new Uint16Array(n)
  const probabilities = new Map<string, Record<Party, number>>()
  let total = (notUp.R ?? 0) + (notUp.D ?? 0) + (notUp.I ?? 0)

  races.forEach((race, k) => {
    if (race.chamber !== chamber) return
    total += 1
    const wins: Record<Party, number> = { R: 0, D: 0, I: 0 }
    const errors = raceErrors.subarray(k * n, (k + 1) * n)
    // Where each party's win goes besides its own seats.
    const blocOfParty = (party: Party): Uint16Array | undefined => {
      const bloc = blocOf(race, party)
      return bloc && blocSeats[bloc]
    }

    if (race.fixedWinner !== undefined) {
      wins[race.fixedWinner] = n
      const winnerSeats = seats[race.fixedWinner]
      for (let i = 0; i < n; i++) winnerSeats[i] += 1
      const winnerBloc = blocOfParty(race.fixedWinner)
      if (winnerBloc) for (let i = 0; i < n; i++) winnerBloc[i] += 1
    } else if (race.type === 'MT3') {
      // One race: the full §3.1 rule, with ε_n + ε_r added to Δ.
      for (let i = 0; i < n; i++) {
        const { winner } = outcomeAt(race, delta + national[i] + errors[i])
        wins[winner] += 1
        seats[winner][i] += 1
        const bloc = blocOfParty(winner)
        if (bloc) bloc[i] += 1
      }
    } else {
      if (race.rep === null || race.opp === null) throw new Error(`${race.id}: a contested race needs two candidates`)
      // The §3.1 cap never changes the sign of the margin, so the winner is
      // the sign of m0 + slope·(Δ + ε_n) + ε_r (an exact 0 goes to the REP slot).
      const base = race.m0 + race.slope * delta
      const { slope } = race
      const repSeats = seats[race.rep.party]
      const oppSeats = seats[race.opp.party]
      // An independent with no caucus joins no bloc: a scratch array.
      const repBloc = blocOfParty(race.rep.party) ?? scratch
      const oppBloc = blocOfParty(race.opp.party) ?? scratch
      let repWins = 0
      for (let i = 0; i < n; i++) {
        if (base + slope * national[i] + errors[i] >= 0) {
          repWins += 1
          repSeats[i] += 1
          repBloc[i] += 1
        } else {
          oppSeats[i] += 1
          oppBloc[i] += 1
        }
      }
      wins[race.rep.party] += repWins
      wins[race.opp.party] += n - repWins
    }

    probabilities.set(race.id, { R: wins.R / n, D: wins.D / n, I: wins.I / n })
  })

  const distributions = Object.fromEntries(
    PARTIES.map((party) => [party, distribution(seats[party], total)]),
  ) as Record<Party, SeatDistribution>
  const blocs = { R: distribution(blocSeats.R, total), D: distribution(blocSeats.D, total) }
  const R =
    chamber === 'house'
      ? shareAtLeast(blocs.R.histogram, HOUSE_MAJORITY, n)
      : shareAtLeast(blocs.R.histogram, SENATE_R_CONTROL, n)
  const opposition = chamber === 'house' ? shareAtLeast(blocs.D.histogram, HOUSE_MAJORITY, n) : 1 - R

  return { probabilities, seats: distributions, blocs, control: { R, opposition } }
}
