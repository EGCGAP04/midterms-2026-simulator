# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository setup: Vite + React + TypeScript (strict) app with Vitest and oxlint, CI and GitHub Pages workflows, Dependabot, Issue forms, PR template, security policy and the project specification (`docs/SPEC.md`).
- Data exporter (`scripts/export_data.py`): reads the forecast workbook, runs the self-checks in SPEC §2.6 (race counts, ratings, flips, seat totals, rating counts, Montana's shares, sheet reference) and writes `public/races.json` with every House and Senate race, its type, candidates, incumbency, baseline margin and 2024 context. Unit tests for its helpers run in CI.
- Forecast model, first part (`src/model/`): margins and winners under the slider (normal, blend, fixed and Montana's three-way race, with the ±90 cap), ratings, rating counts and seat totals, with unit tests and the SPEC §5 acceptance tests against `races.json`.
- Correlated Monte Carlo (`src/model/simulate.ts`): 10,000 simulations with a shared national error and per-race errors, drawn once from a seeded generator, giving per-race win probabilities, each party's median seats, 80% interval and seat histogram, and the chance of control. Tests check that every race's probability moves with the slider; `npm run bench` times it locally.
- English and Spanish UI strings (`src/i18n/`): a lookup with an English fallback, and locale-aware margins ("D+8.75" / "D+8,75", "EVEN" / "Empate") and win probabilities (">99%", "<1%"). A test keeps both catalogs' keys and placeholders in step.
- Header and slider: the title, a House/Senate switch and an EN/ES toggle; the national-environment slider from D+29 to R+20 in 0.01-point steps, with its value (coloured along the track's gradient), a marker at the default (D+8.75) and a reset button. The arrow keys move it by 0.1 points and Shift+arrow by 1 point. Light and dark themes, and a layout that works on a phone.
- URL state (`?ch=house&env=-8.75&lang=es`): the page opens on the shared scenario, ignores invalid values, follows the browser language when `lang` is missing, and keeps the URL in step without adding history entries. It writes `lang` only when it differs from the browser language, so a shared link opens in the reader's language.
- Summary bar: one continuous bar of the chamber's seats by rating at the slider's environment, from Safe D to Safe R, with independents in the middle on the side of the party they run against and, in the Senate, the seats not up at the ends (striped, set off by vertical lines and labelled "Not up for grabs in 2026"); a majority line; each side's seat total and chance of control (D + I in the Senate; independents totalled on their side of the bar); a tooltip per block and a "Seats by rating" table. The rating colours (four steps per party, darker for safer seats in both themes) are shared with the maps.
- Light/dark theme toggle in the header: it follows the browser until the reader picks a theme, which the browser then remembers.
- The page loads `races.json` and runs the simulation as the slider moves, with a loading and an error message.
- Senate map (`us-atlas`, `d3-geo`, `topojson-client`): each state with a race in its rating's colour at the slider, the others in grey, independents in violet and a hatch for fixed races; squares for the small North-East states; a tooltip with the race's name, rating, margin and the leader's chance of winning on hover or keyboard focus, and a selected race (click, tap, Enter or Space; Escape clears it). The map is fetched on its own (31 kB gzipped), outside the main bundle. State and race names in both languages.
- House map: a hex cartogram with one hexagon per district, grouped by state, in the same colours, hatch, tooltip and selection as the Senate map, with wider gaps between states and their postal codes on top. No openly licensed layout matched the current apportionment, so `scripts/house_hexes.ts` (`npm run house-hexes`) generates it from the states' centroids; tests check that every district has its own cell, every state is in one piece and no holes are left. A note under the map says that districts follow number order within a state, not their real places.
- House district map, now the House's default: every district with its real 2026 shape (U.S. Census Bureau TIGER/Line, 120th Congress, with the nine states that redrew; Missouri keeps its 2022–2024 plan), in the same colours, hatch, tooltip and selection as the other maps, with the state borders on top and the source credited under it. It is fetched on its own (`public/us-house-districts-2026.json`, about 0.3 MB compressed) when first shown. A "Districts / Hexagons" switch keeps the hex map, and the choice goes in the URL (`map=hex`). `scripts/build_districts_map.sh` (`npm run districts-map`, needs mapshaper) rebuilds the file from the Census files, byte for byte.
- Zoom and pan on both House maps (`d3-zoom`): the mouse wheel or a pinch zooms the map (up to 40× on the district map, 6× on the hex map), dragging moves it, and zoom in, zoom out and "Show the whole map" buttons work from the keyboard. One finger scrolls the page until the map is zoomed in. Lines and labels keep their size, the tooltip follows its race, and Tab moves the zoomed map to the focused race. It adds about 17 kB gzipped to the bundle.
- The left and right arrow keys move the slider from anywhere on the page, without focusing it first (0.1 points, or 1 point with Shift), except in text fields and other form controls. Up and down keep scrolling the page.
- Race panel, beside the map on wide screens and under it on narrower ones (then before the lists): the selected race's rating and margin, whether it flips, each candidate with their incumbency status and chance of winning (Montana's three-way shares, and the within-party shares of same-party races), its 2024 presidential margin and last election, and notes on how the race works (primary blends, uncontested and same-party races, Montana, independents). Switching chambers clears the selection.
- Key races under the map: the flips at the slider, by the party that loses them; the 10 closest races (fixed races left out); and the tipping-point race, the one that gives control with the races sorted by margin (in the Senate, counting the seats not up). Each race is a button that selects it: on wide screens the race panel stays in view beside the lists, on narrow ones the page scrolls up to it, and a zoomed-in House map moves to the race. Each flip column shows 10 races and a "Show all" button.
- `races.json` carries the workbook's own ratings and totals (`workbookRating`, `workbook`), so the acceptance tests compare the TypeScript model with the workbook.

### Changed

- Issue forms list only the open milestones (M5 and M6), and the roadmap marks M2, M3 and M4 as done.
- Specification: the page opens at D+8.75 (`DEFAULT_ENV`), separate from the workbook baseline; the slider runs from D+29 to R+20 in 0.01-point steps; candidate labels keep only the incumbency status; independents can run in the REP slot; Montana's third candidate is named; each race carries its 2024 presidential margin and its last election as context. Also documents workbook details the exporter must handle.
- The Senate map's description, hover, selection, tooltip and legend moved to `useRaceMap` and `MapParts`, shared with the House maps.
- Real district shapes are in scope: the spec and `CLAUDE.md` describe the district map, its source and how to rebuild it.
- Fixed races (uncontested and same-party) no longer show a margin of ±100 in the map's tooltip.
- The spec lists the supported browsers: Chrome and Edge 123+, Firefox 128+, Safari 18+.

### Fixed

- On the deployed site, the light theme showed the dark theme's text colours when the system preferred dark (and the reverse). The production build replaced `light-dark()` with a fallback that follows only the system theme; the CSS build target now keeps `light-dark()` as written.

[Unreleased]: https://github.com/EGCGAP04/midterms-2026-simulator/commits/main
