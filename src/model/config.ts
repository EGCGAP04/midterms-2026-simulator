// Model constants (docs/SPEC.md §3.3). The sigmas are initial guesses, to be
// calibrated later. Every value is a fraction: 0.01 = 1 point.

export const SIGMA_NAT = 0.03
export const SIGMA_RACE_HOUSE = 0.05
export const SIGMA_RACE_SENATE = 0.045
export const N_SIMS = 10_000
export const SEED = 2026

/** The page's default and recommended environment, D+8.75 (R − D). Not the
 * model baseline: the model always measures the slider against the
 * workbook's g0. */
export const DEFAULT_ENV = -0.0875

/** Slider range and step (§4.2). */
export const ENV_MIN = -0.29
export const ENV_MAX = 0.2
export const ENV_STEP = 0.0001

/** A two-candidate race never shows the loser below 5% (§3.1). */
export const MARGIN_CAP = 0.9
/** Montana: the leading share stays within [5%, 95%] (§3.1). */
export const MT3_SHARE_MIN = 0.05
export const MT3_SHARE_MAX = 0.95

/** Rating thresholds on |margin| (§3.2). */
export const SAFE_MIN = 0.12
export const LIKELY_MIN = 0.06
export const LEAN_MIN = 0.02

/** Seats needed for a House majority, and for R control of the Senate (the
 * Vice President breaks 50–50 ties). */
export const HOUSE_MAJORITY = 218
export const SENATE_R_CONTROL = 50
