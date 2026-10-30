// The races.json schema (docs/SPEC.md §2.5).

export type Party = 'R' | 'D' | 'I'
export type Chamber = 'house' | 'senate'
export type RaceType = 'normal' | 'blend' | 'uncontested' | 'DvD' | 'RvR' | 'MT3'
export type Incumbency = 'incumbent' | 'gainedIncumbency' | 'lostIncumbent' | 'nonIncumbent'

export interface Candidate {
  name: string
  label: Incumbency
  party: Party
}

export interface Context {
  /** Two-party, Trump − Harris (House: on the 2026 lines; Senate: statewide). */
  pres2024: number
  /** House: last House race; Senate: last election for the same seat. */
  last: { margin: number; year: number } | null
  /** House only: the lines changed since `last`. */
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
  shares?: { A: number; B: number; C: number; names: [string, string, string] }
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

export interface Dataset {
  generatedAt: string
  sourceFile: string
  g0: number
  senateNotUp: { D: number; R: number }
  workbook: WorkbookTotals
  races: Race[]
}
