# Midterms 2026 Simulator — Specification

A small static web app to explore a 2026 US House and Senate forecast. The user moves a national-environment slider (generic congressional ballot) and sees every race, the rating counts, seat totals and win probabilities update live.

All code, comments, commit messages and docs are in **English**. The UI is bilingual (**English / Spanish**).

---

## 1. Stack

- Vite + React + TypeScript (strict mode).
- D3 (`d3-geo`, `d3-scale`, `d3-shape`) for the map and charts, rendered as SVG, and `d3-zoom` (with `d3-selection`) for zooming the House maps. `d3-zoom` brings `d3-transition`, `d3-drag`, `d3-interpolate` and their own dependencies: about 17 kB gzipped in all.
- `topojson-client` + `us-atlas` (states) for the Senate map and the hex map's layout.
- The House district map: the Census Bureau's 2026 district boundaries, as TopoJSON in `public/us-house-districts-2026.json` (§4.4). `scripts/build_districts_map.sh` rebuilds it with [mapshaper](https://github.com/mbloch/mapshaper) 0.6.102, installed globally (`npm i -g mapshaper@0.6.102`), not as a project dependency: only that script uses it, and never in CI.
- Browsers: Chrome and Edge 123+, Firefox 128+, Safari 18+. The CSS uses `light-dark()`, relative colours (`oklch(from …)`) and OKLCH gradients. The build's `cssTarget` is set to these versions: with older targets the minifier replaces `light-dark()` with a fallback that follows only the system theme and breaks the theme toggle.
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
| Last House margin | `Q{r}` | Two-party, R − D, on the **old** lines. When there was no R-vs-D race (unopposed, same-party), the workbook puts the presidential result here instead, so `Q = S` exactly: then there is no House margin to show. |
| Last House year | | 2024, or 2022 when the note in `AU{r}` is `*2022` (AL-03, AL-04, AL-05). |
| 2024 presidential margin | `S{r}` | Two-party, Trump − Harris, on the old lines. |
| CPVI new / old | `U{r}` / `V{r}` | `V` is a number when the district was redrawn. The lines changed when `U ≠ V`. |
| Trump / Harris votes | `K{r+1}` / `N{r+1}` | `N` is stored negative. Summed by state, they give each state's 2024 presidential margin (the old districts partition the state). |

Seat checks: `R7` / `S7` hold the D / R totals. `R8:S11` hold the counts by rating (the row is labelled "Tossups" / Lean / Likely / Safe).

**Names.** Asterisks are footnote markers pointing to the notes in column `AU`, and `(I)` marks an independent. For display, drop every `*`, drop `(I)` (the party carries it) and trim the spaces: `"Kevin Kiley* (I)**"` → "Kevin Kiley".

**Labels.** A label is an incumbency status, optionally followed by footnote asterisks and by candidate-quality codes after a dash (`"Incumbent. - SC."`, `"Lost Incumbent - NSC, LSC"`). Only the status is kept; the quality codes (legend in `AB6:AF11`) are dropped. The four statuses, as they appear in the workbook and in the export:

| Workbook | Export | Meaning | Display (EN / ES) |
|---|---|---|---|
| `Incumbent.` | `incumbent` | Holds the seat. | Incumbent / Titular |
| `Gained Incumbency` | `gainedIncumbency` | Became the incumbent at the last race (e.g. won in 2024, or in a special election). | New incumbent / Titular reciente |
| `Lost Incumbent` | `lostIncumbent` | Runs where their party's incumbent is not running: usually an open seat their party holds, but after redistricting it can be a seat whose territory came mostly from that incumbent (AL-02's R candidate, while the seat is D). | Open seat / Escaño abierto |
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
| Last election for the same seat: margin / year | `C` / `D` (two-party, R − D) |

The Senate's 2024 presidential margin is the statewide one, from the House votes (§2.2).

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
  rep: { name: string; label: Incumbency; party: Party } | null; // party: R, or I in the REP slot (D in DvD)
  opp: { name: string; label: Incumbency; party: Party } | null; // party: D, or I (R in RvR)
  m0: number;            // baseline margin, R − opp, fraction
  slope: number;         // 1, or the blend weight
  shares?: { A: number; B: number; C: number; names: [string, string, string] }; // MT3 only
  fixedWinner?: Party;   // uncontested / DvD / RvR
  intraShares?: [number, number]; // DvD / RvR display only
  pollSource?: string;   // Senate only
  workbookRating: string; // the workbook's rating (`AF`), e.g. "Tossup (Tilt R)"; for the acceptance tests
  context: Context;      // shown as context only; the model never uses it
}

interface Context {
  pres2024: number;      // two-party, Trump − Harris. House: on the 2026 lines, S + 2·(U − V) when redrawn
                         // (the workbook's own projection, factor in AD2); Senate: statewide
  last: { margin: number; year: number } | null; // House: last House race (null when Q = S);
                         // Senate: last election for the same seat
  redrawn?: boolean;     // House only: lines changed since `last`, so it was run on other lines
}

interface Dataset {
  generatedAt: string;
  sourceFile: string;
  g0: number;
  senateNotUp: { D: number; R: number };
  workbook: WorkbookTotals; // the workbook's own totals, for the acceptance tests (§5)
  races: Race[];
}

interface WorkbookTotals {
  house: {
    seats: { D: number; R: number };                 // R7 / S7
    ratings: Record<"Tossup" | "Lean" | "Likely" | "Safe", { D: number; R: number }>; // R8:S11
  };
  senate: { seats: { D: number; I: number; R: number } }; // J44 / L44 / N44, seats not up included
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
  - `A' = A + Δ/2`, clamped to [0.05, 0.95].
  - `O = 1 − A'` (the opposition's total; equal to `B + C − Δ/2` when A' is not clamped, and it keeps the three shares adding up to 1 when it is).
  - `B' = O·B/(B+C)` and `C' = O·C/(B+C)`.
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
  - `σ_race` is `SIGMA_RACE_HOUSE` for every House race. In the Senate it depends on the polling (`pollSource`, §2.4): `SIGMA_RACE_SENATE` for a polled race ("Avg" or "CtM"), `SIGMA_RACE_SENATE_NOPOLL` for few polls or none ("Few", or empty). Any other value gets the wider one.
- **Simulated margin:** apply §3.1 with `Δ + ε_n` (times slope) plus `ε_r`. Fixed races don't vary. For MT3, add `ε_n + ε_r` to Δ.
  - The ±0.90 cap never changes the sign of a margin, so a two-candidate race goes to the REP slot when `m0 + slope·(Δ + ε_n) + ε_r ≥ 0` (an exact 0 included, as in §3.1) and to the opposition otherwise.
- **Common random numbers:** draw all errors **once** at startup from a seeded PRNG (mulberry32, Box–Muller normals) and store them in `Float32Array`s. Moving the slider only re-adds the offset, so results are smooth (no jitter) and fast.
  - One stream from `SEED`: the `N` national errors first, then each race's `N` errors in `races.json` order, with that race's `σ_race`. Both chambers share the national errors.
  - Only the chamber on screen is simulated.
- **Per-race win probability:** the share of simulations each side wins. Display `>99%` / `<1%` at the extremes.
- **Chamber outputs, for each party (R, D, I):**
  - Median seats: the smallest seat count reached in at least 50% of the simulations.
  - 80% interval: the same rule at 10% and 90%.
  - Seat histogram.
  - The medians are taken party by party, so they need not add up to the chamber size. Nor do they match the seat totals of §3.4, which count the side ahead in each race.
  - P(majority): House needs 218 (with independent winners, neither party may reach it). In the Senate, R controls at 50 or more seats (the VP breaks ties); the complement is shown as **D + I**, not as D control, because this year's independents have not committed to caucus with the Democrats. D and I seats are reported separately.
- **Config (`src/model/config.ts`).** The sigmas were calibrated in October 2026 (they replace initial guesses of 0.030, 0.050 and 0.045):

| Constant | Value |
|---|---|
| `SIGMA_NAT` | 0.025 |
| `SIGMA_RACE_HOUSE` | 0.055 |
| `SIGMA_RACE_SENATE` | 0.045 (polled: "Avg", "CtM") |
| `SIGMA_RACE_SENATE_NOPOLL` | 0.065 (few polls or none: "Few", empty) |
| `N_SIMS` | 10000 |
| `SEED` | 2026 |
| `DEFAULT_ENV` | −0.0875 (D+8.75): the page's default and recommended environment (§4.2) |

- **Where the sigmas come from:**
  - **National (2.5 points):** the error of RealClearPolitics' final generic-ballot average against the House popular vote in 2010, 2014, 2018, 2020 and 2022, plus 2024 from the workbook (`K6`). The root mean square over the six years is 2.4 points, 3.7 at worst (2020); rounded up to 2.5 for the small sample.
  - **Senate (4.5 and 6.5 points):** the workbook's final formula (its `c`, `k` and `w`, averaging the two estimates) applied to the 177 races of 2016–2022. Each state's environment is the uniform swing with the actual national vote, so what remains is each race's own error. Polled races: 5.1 points in total, about 4.6 once each year's common error (the national one) is taken out. Few or no polls: 6.9 in total, about 6.5. Both are in-sample (the formula's parameters were fitted on the same races), so they may be slightly low.
  - **House (5.5 points), the roughest:** how far each district moved from the national swing relative to its previous election, in 538's results for 2014–2024, R vs D races only and leaving out redistricted states and years. It was 4.1 in 2024 and 6.4 in 2020, but 7.9–8.3 in the 2014 and 2018 midterms. The model knows more than the previous result (the presidential margin, the candidates), so that is an upper bound; 2026 being a midterm, the value is in between.

### 3.4 Seat totals

- **House:** sum of winners (fixed races included). An independent winner counts as I, reported separately; there are none at the baseline.
- **Senate:** winners plus seats not up (D 34, R 31). Independents are counted separately.

---

## 4. UI

Use a responsive layout that also works on a phone.

1. **Header:**
   - Title: "Midterms 2026 Simulator" in both languages, as the app's name. Below it, a translated subtitle.
   - EN/ES toggle.
   - House/Senate switch.
   - Light/dark theme toggle. The page follows the browser's theme until the reader picks one; the choice is remembered in that browser (`localStorage`), not put in the URL.
2. **Slider:**
   - "Estimated National Environment (Generic Congressional Ballot)", range D+29 … R+20 in 0.01-point steps.
   - Keyboard: the arrow keys move it by 0.1 points and Shift+arrow by 1 point (right and up toward R), from the current value and within the range. Dragging keeps the 0.01-point step; Page Up/Down, Home and End keep the browser's behaviour.
   - Left and right also move it from anywhere on the page, without focusing it first, with the same steps. Not while the focus is in a text field or another form control (where the arrows already mean something), or when something else on the page has handled the key. Up and down keep scrolling the page: they move the slider only when it has the focus.
   - Starts at `DEFAULT_ENV` (D+8.75) unless the URL sets another value.
   - Shows the current value with two decimals (e.g. "D+8.75", or "D+8,75" in Spanish; "EVEN" at 0), in the track's colour at that point, darkened (light theme) or lightened (dark theme) just enough to read.
   - The track uses the rating colours (§4.3), the same in both themes: light grey (`#E4E4E4`) at EVEN, Tilt at 2 points, Lean at 4, Likely at 8 and Safe from 16 on, each side in its party's colours, mixed in OKLCH between stops.
   - A marker at the default and a "Reset to default (D+8.75)" button. The workbook baseline `g0` is not shown.
3. **Summary bar:**
   - Stacked horizontal bar of the chamber's seats by rating at the slider's environment (§3.2), one block per rating with its seat count inside when it fits:
     - Left to right: Safe D, Likely D, Lean D, Tilt D, then the violet blocks for races an independent leads, then Tilt R, Lean R, Likely R, Safe R.
     - Independents sit on the side of the party they run against: one in the opposition slot (against R, e.g. Osborn in Nebraska) next to D, as in the Senate's "D + I"; one in the REP slot (against D, e.g. Kiley in CA-06) next to R.
     - **Senate:** the seats not up for election (D 34, R 31) sit at the two ends, in the same solid colour as Safe (not a lighter one, which would read as competitive), with diagonal stripes in the block's text colour (45° for D, 135° for R). A vertical line like the majority line marks where they end, and a bracket under each one says "Not up for grabs in 2026".
     - One continuous bar, without gaps between blocks; only its two ends are rounded.
     - Blocks are sized by seats and placed exactly, so the majority line sits in the middle: 218 in the House, where a party crossing it has a majority. In the Senate R controls with 50 (the Vice President breaks ties) and D + I need 51.
   - Above the bar, each side's seat total and P(control) (§3.3):
     - Seat totals are the deterministic count at the slider (§3.4), not a simulation median. A note says so: the medians and the 80% interval come with the histogram (§4.6).
     - **House:** D and R with their chance of a majority. I is shown only when an independent leads a race, next to the party whose side of the bar its races are on (both sides if there are some on each).
     - **Senate:** D and I with the chance of D + I control, and R with its chance of control.
     - Each total's number is centred under its party name; the counts inside the blocks are centred too.
   - Hovering a block shows its rating and seats, and outlines it with the same ring on every block (the text colour, with a ring of the page background inside it). A "Seats by rating" table below the bar lists every block, so no value depends on colour or hover.
   - **Colours:** a diverging scale with four steps per party, from Tilt (lightest) to Safe (darkest), the same in both themes, and violet (`#775EB2`) for independents. The maps reuse it (§4.4). D `#94BBE0`, `#6A9FD0`, `#4382BF`, `#2166AC`; R `#EB9C8C`, `#DC7465`, `#C94843`, `#B2182B`. Text inside a block is white or near-black, whichever contrasts with its fill.
4. **Map:**
   - **Senate:** US states map (`us-atlas`, the pre-projected `states-albers-10m.json`, fetched on its own so the main bundle stays small). States without a race are drawn in neutral grey.
     - No state has two races in 2026: Florida and Ohio hold special elections, and their other seats are not up.
     - The small North-East states (VT, NH, MA, RI, CT, NJ, DE, MD) also get a square with their postal code beside the coast, filled like the state, so they can be seen and tapped.
   - **House:** two maps, with a "Districts / Hexagons" switch above them (only for the House). The district map is the default; the choice goes in the URL (§4.8).
   - **House district map:** every district with its real 2026 shape, and the state borders over them.
     - Source: U.S. Census Bureau TIGER/Line, 120th Congress districts (the lines as of 1 January 2026, published in October 2026). They include the nine states that redrew for 2026 (AL, CA, FL, LA, NC, OH, TN, TX and UT), the same ones `races.json` marks as `redrawn`. Missouri uses the 2024 file (119th Congress): the Supreme Court did not allow its new map for 2026, but the 2026 files carry it. Public domain; the legend credits "U.S. Census Bureau TIGER/Line".
     - `public/us-house-districts-2026.json` (TopoJSON, about 1.1 MB, 0.3 MB compressed; `.json` so that GitHub Pages serves it as JSON and compresses it). `objects.districts` has the 435 districts, with `id` in the same format as `races.json` (`CA-22`, `AK-AL`), `state` (postal code), `STATEFP` and `plan` (`"120"`, or `"119"` for Missouri). `objects.states` has the 50 states, dissolved from the districts. Coordinates are longitude and latitude.
     - `scripts/build_districts_map.sh` (with `scripts/fips.cjs`) rebuilds it from the Census files: it clips the districts to the 1:500k shoreline (the TIGER districts reach into the Great Lakes and the sea) and simplifies them to 6% (weighted, keeping every shape). Run again, it gives an identical file.
     - It is fetched on its own, when the district map is first shown, and projected in the browser with Albers USA at the `us-atlas` scale (975 × 610, `geoAlbersUsa().scale(1300).translate([487.5, 305])`), so it lines up with the Senate map.
     - Thin lines in the page background separate the districts; the state borders are thicker.
     - At full width the smallest districts (New York City, Los Angeles, Chicago, Houston) are 1–2 px²: zoom and pan (below) make them reachable with the mouse or by touch. Every district is in the Tab order.
   - **House hex map:** a **hex cartogram**, one hexagon per district, grouped by state. Use an openly licensed hex layout if one exists with the right number of districts per state (check the licence). Otherwise generate the layout algorithmically, as compact state blocks placed on a US-shaped grid.
     - Every district gets the same area, so the small urban districts can be seen without zooming.
     - No open layout fits (checked in October 2026): Daily Kos Elections' 2022 hexmap uses five hexagons per district and asks for attribution, its earlier versions were CC BY-SA 4.0, and the one-hexagon versions predate the 2022 apportionment. So `scripts/house_hexes.ts` generates it into `src/state/houseHexes.json` (each district's `[column, row]`, pointy-top hexagons with the odd rows shifted half a hexagon right), committed and checked by tests. Run it again when the number of districts per state changes.
     - The generator starts each state at its `us-atlas` centroid as a circle with its hexagons' area, pushes the circles apart (a Dorling cartogram, pulled back toward the centroids and lightly toward the middle of the map), then grows the states one at a time from their centres, so each stays in one piece. A few North-East states start slightly moved so the coast keeps its order. Holes boxed in by states move out of the map.
     - Within a state the districts go in reading order (left to right, top to bottom): their positions do not follow the real districts. A note under the map says so.
     - Wider gaps (in the page background) separate the states, and each state's postal code sits over the middle of its block.
   - **Zoom and pan (both House maps):** with `d3-zoom`, up to 40× on the district map (at 360 px wide, the smallest New York City districts are then about 15 × 25 px) and 6× on the hex map. The Senate map has none: its states are large enough, and the small North-East ones have their squares.
     - Over the map, the mouse wheel zooms the map, never the page, even at the widest zoom. Ctrl/⌘ + wheel stays the browser's page zoom elsewhere; over the map it is a trackpad pinch, so it zooms the map too.
     - Dragging moves the map once it is zoomed in. A click that moves less than 3 px still counts as a click, so races stay selectable.
     - Touch: a pinch zooms the map. One finger scrolls the page until the map is zoomed in; then it moves the map.
     - Zoom in, zoom out and "Show the whole map" buttons in the map's top-right corner, usable with the keyboard; each step doubles or halves the zoom. No double-click zoom: a second click on a race clears its selection.
     - Lines keep their width and the hex map's postal codes their size at any zoom. Zoomed in, the map is clipped to its frame.
     - The tooltip follows its race, and hides while the race is out of view. Focusing a race with Tab while zoomed in moves the map to it, and so does selecting one out of view from outside the map (the lists, §4.7), keeping the zoom.
     - A note under the map explains the wheel, the pinch and dragging. Switching maps or chambers resets the zoom.
   - **Fill:** a diverging scale by margin, matching the rating buckets. Fixed races get a hatch pattern; independents are violet (`#775EB2`).
     - The colours are the summary bar's (§4.3), by each race's rating at the slider. The hatch is white stripes over the fill.
     - A legend under the map explains the grey and, when the chamber has fixed races, the hatch.
   - **Hover, focus and selection:**
     - Hovering a race, or focusing it with the keyboard (every race is in the Tab order), shows a tooltip with its name, rating, margin and the leader's chance of winning, and outlines it in the text colour. A fixed race shows no margin: its ±100 is not a real one.
     - A click, a tap, Enter or Space selects the race: it keeps the outline and the tooltip until another race is selected, it is clicked again, the map's background is clicked or Escape is pressed. The race panel (§4.5) shows the selected race.
     - The selection belongs to its chamber: switching chambers clears it, and switching back does not restore it.
     - On a touch screen there is no hover: a tap selects.
5. **Race panel:** the selected race (§4.4) in full. Hovering keeps the short tooltip; the panel is what a click, a tap or Enter opens.
   - Beside the map and the lists (§4.7) on wide screens (from 64rem, the map then a little narrower), and it stays in view while the page scrolls past them; under the map, before the lists, on narrower ones. Without a selection it says how to pick a race. Screen readers hear it change (`aria-live="polite"`).
   - **Heading:** the race's name, its rating at the slider in the map's colour, and the margin (none for a fixed race, as in the tooltip).
   - **Flip flag:** when the side ahead is not the party that holds the seat (`holder`), "Flip: R → D" (an independent too: "R → I"); otherwise "Hold: R".
   - **Candidates**, the REP slot first, each with the party letter (I included), the incumbency status (§2.2) and the chance of winning (§3.3):
     - **MT3:** the three candidates with their shares at the slider (§3.1) as well. The workbook gives no status for Bankhead, so none is shown.
     - **DvD / RvR:** both candidates with their within-party shares (`intraShares`) instead of a chance: the seat is decided, and the model does not say which of the two wins.
     - **Uncontested:** the only candidate.
   - **Context**, as background only: the 2024 presidential margin and the last House race (with its year, and "old lines" when `redrawn`) or, in the Senate, the last election for that seat. One decimal, e.g. "Pres. 2024: R+11.4 · House 2024: R+13.9 (old lines)". A House race whose last election was not R vs D (`last` is null) shows only the presidential margin.
   - **Type notes**, one line each (a race can have two, e.g. a blend with an independent):
     - `blend`: "Top-two primary blend" ("top-four" in Alaska), and how much it moves with the environment (the slope, as a percentage).
     - `uncontested`: only one candidate is running.
     - `DvD` / `RvR`: two candidates of the same party, so the seat stays with that party whatever the environment.
     - `MT3`: a three-way race; Alme's share moves by half the environment's shift and Bodnar and Bankhead split the rest in proportion.
     - **Independent** (not in `MT3`, where all three parties run): there is no candidate of the party whose slot the independent takes, and they move with that side of the environment.
6. **Seat histogram** from the simulations, with the majority line.
7. **Lists** ("Key races"), under the map, at the slider's environment. Every race in them is a button that selects it (§4.4), so the race panel shows it and the map outlines it; the selected one is marked in the lists too. Each shows its name and its margin (its rating for a fixed race), with a square in its rating's colour.
   - **Flips:** the races whose side ahead is not the party that holds the seat (§4.5), in one column per party that loses them: "R loses" and "D loses", each with its count ("None" when empty). An independent's gain goes in the column of the party that held the seat (Osborn in Nebraska: "R loses"). Fixed races count: a same-party race in a seat the other party held is a flip at any environment. Within a column, the clearest flips first (the largest margin), fixed races at the top. A column shows its first 10 and a "Show all N" button ("Show fewer" to fold it again), so the list stays short at the slider's ends.
   - **Closest races:** the 10 with the smallest margin, either side, fixed races left out.
   - **Tipping point:** sort the races by margin (R − opposition, so an independent sits on the side of the party it runs against, as in the summary bar) and take the one that gives control: in the House the 218th from the most R end, which is also the 218th from the most D end (435 races). In the Senate, with the seats not up (R 31, D 34), the 19th most R race, which is also the 17th most D: R needs 50 seats, D + I 51. The side that wins it has control, so its margin shows how close control is. With independents in the House this is only approximate: an independent ahead counts as a seat on its side, not as a seat of that party.
   - Wide screens: the lists go under the map, in the map's column, so the race panel stays beside them. Narrow screens: map, race panel, then the lists; picking a race in a list scrolls the page up to the panel when its top is off the screen.
8. **URL state:** e.g. `?ch=house&env=-5.25&lang=es&map=hex` (`env` in points, R − D, up to two decimals), so scenarios can be shared.
   - `ch` is `house` or `senate`, `house` by default.
   - `map` is `hex` for the House hex map. Without it, the House shows the district map, so the page writes it only for `hex` (whatever the chamber, so the choice survives a trip to the Senate).
   - `env` is a number in the slider range, rounded to 0.01. Without it, the page uses `DEFAULT_ENV`.
   - `lang` is `en` or `es`. Without it, the page follows the browser language: Spanish if it starts with `es`, English otherwise.
   - The page writes `lang` only when it differs from the browser language, so a shared link opens in the reader's language. A link from someone who switched away from their browser language still carries it.
   - An invalid or out-of-range value is ignored, as if it were missing.
   - The page keeps the URL in step with the state (`history.replaceState`, so it adds no history entries). It writes them once the slider stops for a moment, not on every step: browsers throttle frequent URL changes.

### i18n

- All strings live in `src/i18n/en.json` and `es.json` (Rioplatense Spanish is fine, but keep the UI neutral).
  - Flat keys (`"slider.reset"`). English is the reference: a key missing from Spanish falls back to English, and a test checks that both catalogs have the same keys and placeholders (`{value}`).
- Numbers are formatted with `Intl.NumberFormat` (`en-US`, `es-AR`): `es-AR` uses a decimal comma.
- **Margins:** the letter of the party ahead and the margin in points, with two decimals: "D+8.75" ("D+8,75" in Spanish), "I+3.10". A margin that rounds to 0 shows as "EVEN" ("Empate" in Spanish).
- **Ratings:** Safe, Likely, Lean and Tilt, followed by the party letter ("Lean D"). In Spanish the party letter goes first: Seguro, Probable, Favorito and Ajustado ("D favorito"). Seats are "escaños" in Spanish.
- **Probabilities:** whole percentages, shown as ">99%" above 99% and "<1%" below 1%, fixed races included.

---

## 5. Acceptance tests

- **At the baseline (slider = g0)**, which the model tests use directly. The expected values come from `races.json` (`workbookRating` and `workbook`), not from numbers written into the tests, so the tests keep working when the forecast is updated:
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
/scripts/test_export_data.py   (unit tests of the pure helpers, stdlib unittest)
/scripts/bench.ts              (times the simulation: npm run bench, local only)
/scripts/house_hexes.ts        (generates the House map's layout: npm run house-hexes)
/scripts/build_districts_map.sh (rebuilds the district map from the Census files: npm run districts-map; needs mapshaper)
/scripts/fips.cjs              (postal codes by FIPS code, for mapshaper)
/requirements.txt              (openpyxl, for the exporter)
/public/races.json
/public/us-house-districts-2026.json   (the House district map, TopoJSON)
/src/model/{margin.ts, ratings.ts, seats.ts, simulate.ts, summary.ts, config.ts}
/src/components/{Header, Toggle, Slider, SummaryBar, SenateMap, HouseDistrictMap, HouseHexMap, MapParts, Tooltip, Histogram, RaceLists}.tsx
/src/components/useRaceMap.ts  (what the maps share: race descriptions, hover, focus and selection)
/src/components/useMapZoom.ts  (zoom and pan for the House maps, with d3-zoom)
/src/i18n/{en.json, es.json, i18n.ts, format.ts}
/src/model/states.ts           (postal codes by FIPS code)
/src/state/{env.ts, url.ts, dataset.ts, theme.ts, forecast.ts, atlas.ts, districts.ts}   (slider rounding and key steps; the URL state; loading races.json; the theme; a chamber's outcomes and chances; loading the states map; loading the district map)
/src/state/{hexGrid.ts, houseHexes.json, houseLayout.ts}   (the hexagon grid; the generated House layout; its hexagons, borders and labels)
/README.md   (how to regenerate the data and deploy)
```
