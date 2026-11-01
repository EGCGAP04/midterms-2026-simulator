// The races.json schema (docs/SPEC.md §2.5).

export type Party = 'R' | 'D' | 'I'
export type Chamber = 'house' | 'senate'
export type RaceType = 'normal' | 'blend' | 'uncontested' | 'DvD' | 'RvR' | 'MT3'
export type Incumbency = 'incumbent' | 'gainedIncumbency' | 'lostIncumbent' | 'nonIncumbent'

export interface Candidate {
  name: string
  label: Incumbency
  party: Party
  /** Independents only: the party they caucus with (Kiley: R). */
  caucus?: 'D' | 'R'
}

export interface Context {
  /** Two-party, Trump − Harris (House: on the 2024 lines; Senate: statewide). */
  pres2024: number
  /** House: last House race; Senate: last election for the same seat. */
  last: { margin: number; year: number } | null
  /** House only: the lines changed for 2026, so both results are on the old ones. */
  redrawn?: boolean
}

export interface Race {
  id: string
  chamber: Chamber
  state: string
  name: string
  type: RaceType
  holder: Party
  rep: Candidate | null
  opp: Candidate | null
  /** Baseline margin, R − opposition, as a fraction. */
  m0: number
  slope: number
  /** MT3 only: Alme, Bodnar and Bankhead's baseline shares. */
  shares?: { A: number; B: number; C: number; names: [string, string, string]; thirdLabel: Incumbency }
  fixedWinner?: Party
  intraShares?: [number, number]
  pollSource?: string
  workbookRating: string
  context: Context
}

export type RatingBucketName = 'Tossup' | 'Lean' | 'Likely' | 'Safe'

export interface WorkbookTotals {
  house: {
    seats: { D: number; R: number }
    ratings: Record<RatingBucketName, { D: number; R: number }>
  }
  senate: { seats: { D: number; I: number; R: number } }
}

export interface Senator {
  state: string
  name: string
  party: Party
}

export interface Dataset {
  generatedAt: string
  /** The forecast's date, "2026-10-31". */
  asOf: string
  sourceFile: string
  g0: number
  /** I: Sanders and King, who caucus with D. */
  senateNotUp: { D: number; I: number; R: number }
  /** The senators not up in 2026 (docs/SPEC.md §2.4). */
  senatorsNotUp: Senator[]
  workbook: WorkbookTotals
  races: Race[]
}
