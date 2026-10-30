# Midterms 2026 Simulator — Specification

A small static web app to explore a 2026 US House and Senate forecast. The user moves a national-environment slider (generic congressional ballot) and sees every race, the rating counts, seat totals and win probabilities update live.

All code, comments, commit messages and docs are in **English**. The UI is bilingual (**English / Spanish**).

---

## 1. Stack

- Vite + React + TypeScript (strict mode).
- D3 (`d3-geo`, `d3-scale`, `d3-shape`) for the map and charts, rendered as SVG.
- `topojson-client` + `us-atlas` (states) for the Senate map.
- No backend. The app ships one static `races.json`. Deploy target: GitHub Pages (add a workflow) or Vercel.
- Data exporter: Python 3 + `openpyxl` (`scripts/export_data.py`).
- Unit tests: Vitest for the model logic (`src/model/`).

---

## 2. Data source and exporter

The forecast lives in an Excel workbook, `2026_US_Elections.xlsx`. The exporter reads **cached values** with `openpyxl.load_workbook(path, data_only=True)`. The file is always saved by Excel, so the caches are present. It also reads formulas in a second pass with `data_only=False`, but only to detect race types.

CLI:

```
python scripts/export_data.py <xlsx> --house-sheet "Senate House" --senate-sheet "29-10 Senate" --out public/races.json
```

Sheet names change with each update, so they are arguments.

### 2.1 Baseline

- `g0 = 'Senate House'!G11` (currently −0.09, i.e. D+9.0). This is the **model baseline**: the environment at which every race equals the workbook. It is never shown on the page; the page opens at its own default, `DEFAULT_ENV` (§3.3, §4).
- All margins are **R − D** (or R − opposition) as fractions: −0.09 = D+9.
- The House sheet named in `--house-sheet` is the one the Senate sheet references, so both chambers share the same baseline.

### 2.2 House sheet layout

There are 435 districts. Each uses **two rows**: data row `r` = 15, 17, …, 883, and its companion row `r+1`.

| Field | Cell | Notes |
|---|---|---|
| District name | `C{r}` | e.g. "California 22". Build an ID like `CA-22`; at-large districts ("Alaska at-large", and Wyoming's, written just "Wyoming") become `AK-AL`, `WY-AL`, etc. |
| REP-slot candidate | `Y{r}` | `None` means no candidate. Usually a Republican, but `(I)` in the name means an independent runs in this slot because there is no Republican (AZ-03, CA-06, MA-01, PA-03). |
| DEM / opposition candidate | `AB{r}` | `(I)` in the name means independent (AK-AL). |
| REP label | `Y{r+1}` | The incumbency status (see below). |
| DEM label | `AB{r+1}` | Same as above. |
| REP share | `AA{r}` | Positive number. |
| DEM share | `AD{r}` | Stored **negative**. |
| Baseline margin m0 | `AE{r}` | `AA + AD`; positive = R. |
| Rating | `AF{r}` | |
| Flip | `AH{r}` | "NO", "Yes, REP" or "Yes, DEM". |
| 2024 holder | `G{r+1} + J{r+1}` | ≥ 0 → R, otherwise D. This matches the Flip formula. |

Seat checks: `R7` / `S7` hold the D / R totals. `R8:S11` hold the counts by rating (the row is labelled "Tossups" / Lean / Likely / Safe).

**Names.** Asterisks are footnote markers pointing to the notes in column `AU`, and `(I)` marks an independent. For display, drop every `*`, drop `(I)` (the party carries it) and trim the spaces: `"Kevin Kiley* (I)**"` → "Kevin Kiley".

**Labels.** A label is an incumbency status, optionally followed by footnote asterisks and by candidate-quality codes after a dash (`"Incumbent. - SC."`, `"Lost Incumbent - NSC, LSC"`). Only the status is kept; the quality codes (legend in `AB6:AF11`) are dropped. The four statuses, as they appear in the workbook and in the export:

| Workbook | Export | Meaning | Display (EN / ES) |
|---|---|---|---|
| `Incumbent.` | `incumbent` | Holds the seat. | Incumbent / Titular |
| `Gained Incumbency` | `gainedIncumbency` | Became the incumbent at the last race (e.g. won in 2024, or in a special election). | New incumbent / Titular reciente |
| `Lost Incumbent` | `lostIncumbent` | Runs for a seat their party holds, whose incumbent is not running. | Open seat (party holds it) / Escaño abierto (de su partido) |
| `Non-Incumbent` | `nonIncumbent` | Anyone else. | Non-incumbent / No titular |

An unknown status makes the exporter fail.

### 2.3 House race types

Detect the type from the formula in `AA{r}`:

| Type | Detection | Count | Behaviour |
|---|---|---|---|
| `uncontested` | `AA` formula has no `G$11` and `Y{r}` starts with "None" | 5 (FL-10, MA-02, MA-05, MA-07, WI-02) | Fixed seat for that party, probability 100%. Shown as "Uncontested" and not moved by the slider. |
| `DvD` / `RvR` | `AA` has no `G$11`, `Y{r}` is a real name; `AE = −1` → DvD, `+1` → RvR | 9 (CA-04, 07, 11, 12, 14, 29, 34, 37 DvD; CA-40 RvR) | Seat fixed for the party at 100%. Show both candidates with their within-party shares `abs(AA)` and `abs(AD)`, which stay fixed. |
| `blend` | `AA` contains both `AS` and `AT` (top-two/top-four primary blend) | 44 (AK-AL + 43 CA) | Slope = `1 / (1 + AT{r} / AT{r+1})`. |
| `normal` | everything else | | Slope = 1. |

**Independents** are not a race type: they are marked by `party: "I"` on the side they run on, and can appear in a `normal` or a `blend` race. An independent takes that side of the slider (the REP slot moves toward R, the opposition toward D), and is coloured violet. On the opposition side: AK-AL (Bill Hill, `blend`). In the REP slot: AZ-03 (Alan Aversa), CA-06 (Kevin Kiley, no party preference), MA-01 (Nadia Milleron) and PA-03 (Dennis Mahoney).

### 2.4 Senate sheet layout

There are 35 races in rows 7–41, one row per race and one race per state.

| Field | Cell |
|---|---|
| State | `B` (e.g. "Florida (special)") |
| Seat holder | `J` (R/D) |
| REP candidate / label | `K` / `L` |
| DEM or opposition candidate / label | `M` / `N` ("(I)" = independent: ID, MT, NE, SD) |
| Poll source | `U` ("Avg", "CtM", "Few" or empty) |
| Baseline margin m0 | `AE` |
| Rating | `AF` |
| Flip | `AG` |

Seats not up: `N3` = 34 D, `P3` = 31 R. Checks: `J44` (D), `L44` (I), `N44` (R) = 52 / 0 / 48 currently.

**Montana (row 25, type `MT3`).** It is a three-way race: Kurt Alme (R), Seth Bodnar (I), Alani Bankhead (D). Bankhead's name is not in any cell (only the note in `AH25` mentions "Bankhead"), so the exporter holds it as a constant and fails if `AH25` stops mentioning her.
- `m3 = AVERAGE(AC25, AD25)` is Alme − (Bodnar + Bankhead).
- `c = AE25 − m3` is Bankhead's share.
- Baseline shares:
  - `A = (1 + m3) / 2`
  - `C = c`
  - `B = 1 − A − C`
- `AE25 = A − B` (Alme − Bodnar). Check this.

Senate names and labels follow the same rules as the House (§2.2).

Senate slope = **1** for all races. This is a design choice: when the national environment moves, state polls are assumed to move with it.

### 2.5 `races.json` schema

```ts
type Party = "R" | "D" | "I";
type RaceType = "normal" | "blend" | "uncontested" | "DvD" | "RvR" | "MT3";
type Incumbency = "incumbent" | "gainedIncumbency" | "lostIncumbent" | "nonIncumbent";

interface Race {
  id: string;            // "CA-22", "MT-SEN"
  chamber: "house" | "senate";
  state: string;         // USPS code
  name: string;          // display name
  type: RaceType;
  holder: Party;         // current/2024 party
  rep: { name: string; label: Incumbency; party: Party } | null; // party: R, or I in the REP slot
  opp: { name: string; label: Incumbency; party: Party } | null; // party: D, or I
  m0: number;            // baseline margin, R − opp, fraction
  slope: number;         // 1, or the blend weight
  shares?: { A: number; B: number; C: number; names: [string, string, string] }; // MT3 only
  fixedWinner?: Party;   // uncontested / DvD / RvR
  intraShares?: [number, number]; // DvD / RvR display only
  pollSource?: string;   // Senate only
}

interface Dataset {
  generatedAt: string;
  sourceFile: string;
  g0: number;
  senateNotUp: { D: number; R: number };
  races: Race[];
}
```

### 2.6 Exporter self-checks

The exporter must fail loudly if any check fails:
- 435 House races and 35 Senate races.
- Recomputed ratings equal `AF` for every race (the workbook writes the Tilt ratings as `Tossup (Tilt R)` / `Tossup (Tilt D)`).
- Each race's flip (`AH` / `AG`) matches its holder and its baseline winner.
- Every label maps to a known incumbency status.
- House seat totals equal `R7` / `S7`.
- House rating counts equal `R8:S11`.
- Senate totals equal `J44` / `L44` / `N44`.
- Montana `A − B` equals `AE25` within 1e-9.

---

## 3. Model (in `src/model/`, pure functions with unit tests)

### 3.1 Margin under the slider

Let `g` be the slider value (fraction, range −0.20 … +0.20, R − D) and `Δ = g − g0`. The model always measures the slider against the workbook baseline `g0`, never against the page default.

- **normal / blend:** `m = m0 + slope × Δ`, then clamp to `[−L, L]`, where `L = max(0.90, |m0|)`. This keeps the loser at 5% or more, and a race that already starts beyond the cap never moves further out.
- **uncontested / DvD / RvR:** fixed winner; the slider has no effect.
- **MT3:**
  - `A' = A + Δ/2`
  - `O = B + C − Δ/2`
  - `B' = O·B/(B+C)` and `C' = O·C/(B+C)`
  - Clamp A' to [0.05, 0.95].
  - Winner = argmax(A', B', C'). Displayed margin = A' − max(B', C').

### 3.2 Ratings

The same thresholds apply to both chambers, using |m|:

| |m| | Rating |
|---|---|
| ≥ 12% | Safe |
| 6–12% | Likely |
| 2–6% | Lean |
| < 2% | Tossup (Tilt) |

- m ≥ 0 → R side (exactly 0 counts as Tilt R).
- If the side ahead is an independent (on either side), it is labelled **I** instead of R or D, in violet.

### 3.3 Probabilities (Monte Carlo with correlated errors)

Errors are correlated across races: if the polls miss the national environment, they miss most races in the same direction. Independent per-race probabilities would give a seat distribution that is far too narrow, so the app simulates.

- **Simulations:** `N = 10,000`. Each one draws a shared national error `ε_n ~ Normal(0, σ_nat)` and one race error per race `ε_r ~ Normal(0, σ_race)`.
- **Simulated margin:** apply §3.1 with `Δ + ε_n` (times slope) plus `ε_r`. Fixed races don't vary. For MT3, add `ε_n + ε_r` to Δ.
- **Common random numbers:** draw all errors **once** at startup from a seeded PRNG (e.g. mulberry32) and store them in `Float32Array`s. Moving the slider only re-adds the offset, so results are smooth (no jitter) and fast.
- **Per-race win probability:** the share of simulations each side wins. Display `>99%` / `<1%` at the extremes.
- **Chamber outputs:**
  - Median seats.
  - 80% interval.
  - Seat histogram.
  - P(majority): House needs 218. In the Senate, R controls at 50 or more seats (the VP breaks ties); report D + I separately.
- **Config (`src/model/config.ts`), initial guesses to calibrate later:**

| Constant | Value |
|---|---|
| `SIGMA_NAT` | 0.030 |
| `SIGMA_RACE_HOUSE` | 0.050 |
| `SIGMA_RACE_SENATE` | 0.045 |
| `N_SIMS` | 10000 |
| `SEED` | 2026 |
| `DEFAULT_ENV` | −0.0875 (D+8.75): the page's default and recommended environment (§4.2) |

### 3.4 Seat totals

- **House:** sum of winners (fixed races included). An independent winner counts as I, reported separately; there are none at the baseline.
- **Senate:** winners plus seats not up (D 34, R 31). Independents are counted separately.

---

## 4. UI

Use a responsive layout that also works on a phone.

1. **Header:**
   - Title.
   - EN/ES toggle.
   - House/Senate switch.
2. **Slider:**
   - "Estimated National Environment (Generic Congressional Ballot)", range D+20 … R+20 in 0.01-point steps.
   - Starts at `DEFAULT_ENV` (D+8.75) unless the URL sets another value.
   - Shows the current value with two decimals (e.g. "D+8.75", or "D+8,75" in Spanish; "EVEN" at 0).
   - A marker at the default and a "Reset to default (D+8.75)" button. The workbook baseline `g0` is not shown.
3. **Summary bar:**
   - Stacked horizontal bar by rating, from Safe D to Safe R (plus I in the Senate), with a majority line (218 / 50).
   - Seat totals and P(control) for each party.
4. **Map:**
   - **Senate:** US states map (`us-atlas`). States without a race are drawn in neutral grey.
   - **House:** a **hex cartogram**, one hexagon per district, grouped by state. Use an openly licensed hex layout if one exists with the right number of districts per state (check the licence). Otherwise generate the layout algorithmically, as compact state blocks placed on a US-shaped grid.
     - Use hexes rather than real district shapes: many states redrew their maps for 2026, and public 2026 geometries are not readily available.
   - **Fill:** a diverging scale by margin, matching the rating buckets. Fixed races get a hatch pattern; independents are violet (`#775EB2`).
5. **Tooltip / side panel (hover or tap):**
   - Candidates and their incumbency status (§2.2), with the party, I included.
   - Margin.
   - Rating.
   - Win probability.
   - Flip flag.
   - Type note (e.g. "Top-two primary blend", "Uncontested", "D vs D").
6. **Seat histogram** from the simulations, with the majority line.
7. **Lists:**
   - Flips (both directions).
   - Closest races.
   - The **tipping-point** race: sort races by margin and find the one that gives the majority.
8. **URL state:** e.g. `?ch=house&env=-5.25&lang=es` (`env` in points, R − D, up to two decimals), so scenarios can be shared. Without `env`, the page uses `DEFAULT_ENV`.

### i18n

- All strings live in `src/i18n/en.json` and `es.json` (Rioplatense Spanish is fine, but keep the UI neutral).
- Numbers are formatted with `Intl.NumberFormat`: `es-AR` uses a decimal comma.

---

## 5. Acceptance tests

- **At the baseline (slider = g0)**, which the model tests use directly:
  - Every race's margin equals `m0`.
  - Every rating equals the Excel rating.
  - House D 236 / R 199.
  - Senate D 52 / I 0 / R 48.
  - House rating counts equal `R8:S11`.
- Moving the slider 1 point toward R moves every `normal` House race exactly 1 point. A `blend` race moves by its slope. Fixed races do not move.
- No D-vs-R race shows a loser share below 5%.
- Montana at the baseline: Alme − Bodnar = `AE25`.
- Probabilities are monotonic in the slider for every race.
- The full simulation runs in < 50 ms on a laptop when the slider moves.
- **The page opens at D+8.75, not at the baseline,** so its opening numbers differ slightly from the workbook: House D 235 / R 200 (AL-02 moves from Tilt D to Tilt R; MN-02, NY-19, NC-01, TX-02, TX-17 and WA-05 change rating), Senate unchanged at 52 / 48 (Louisiana becomes Safe R, Maine Tilt D). This is expected.

---

## 6. Repo layout

```
/scripts/export_data.py
/public/races.json
/src/model/{margin.ts, ratings.ts, simulate.ts, config.ts}
/src/components/{Slider, SummaryBar, SenateMap, HouseHexMap, Tooltip, Histogram, RaceLists}.tsx
/src/i18n/{en.json, es.json}
/README.md   (how to regenerate the data and deploy)
```
