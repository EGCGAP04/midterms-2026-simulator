// Model constants (docs/SPEC.md §3.3). Every value is a fraction: 0.01 = 1
// point. The sigmas were calibrated in October 2026; §3.3 says how.

/** The shared national error: the generic-ballot average's miss. */
export const SIGMA_NAT = 0.025
/** Each House district's own error. */
export const SIGMA_RACE_HOUSE = 0.055
/** Each Senate race's own error, with polls ("Avg" or "CtM")… */
export const SIGMA_RACE_SENATE = 0.045
/** …and with few polls or none ("Few", or no `pollSource`). */
export const SIGMA_RACE_SENATE_NOPOLL = 0.065
/** The `pollSource` values of a polled Senate race. */
export const POLLED_SOURCES: readonly string[] = ['Avg', 'CtM']
export const N_SIMS = 10_000
export const SEED = 2026

/** The page's default and recommended environment, D+8.70 (R − D). Not the
 * model baseline: the model always measures the slider against the
 * workbook's g0. */
export const DEFAULT_ENV = -0.087

/** Past environments marked on the slider (§4.2): the House popular vote,
 * R − D, from the Clerk of the House's totals (2018: 44.85% R – 53.41% D;
 * 2020: 47.23 – 50.27; 2022: 50.01 – 47.29; 2024: 49.75 – 47.19). */
export const PAST_ENVS: readonly { year: number; env: number }[] = [
  { year: 2018, env: -0.0856 },
  { year: 2020, env: -0.0304 },
  { year: 2022, env: 0.0272 },
  { year: 2024, env: 0.0256 },
]

/** Slider range and step (§4.2). */
export const ENV_MIN = -0.29
export const ENV_MAX = 0.2
export const ENV_STEP = 0.0001
/** Keyboard steps: an arrow key moves 0.1 points, Shift+arrow 1 point. */
export const ENV_KEY_STEP = 0.001
export const ENV_SHIFT_STEP = 0.01

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
