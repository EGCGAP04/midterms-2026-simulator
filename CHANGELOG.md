# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The forecast's date under the title: "Forecast as of 10/31" / "Pronóstico al 31/10". The exporter takes it as `--as-of` and writes it to `races.json` (`asOf`).
- A "Ratings | Flips" switch on every map: the flips fill paints the races that flip at the slider in the winner's dark colour and the others in its light one. The choice goes in the URL (`colors=flips`).

### Changed

- A race decided before the vote (uncontested or same-party) shows its winner's chance as "100%" instead of ">99%", in the map's tooltip and the race panel.
- The maps' diagonal stripes mark the races that flip at the slider, not the fixed races (whose plain colour is their rating's). They are dark over light fills, so a flip that is only Tilt shows too. The legend explains them.
- The race panel shows the winner at the slider first (in same-party and three-way races, the largest share), whatever their chance, under a "Candidates" heading. The flip flag becomes a pill before the race's name ("Hold R" on the winner's light colour, "Flip R → D" on its dark one), and the margin, in the leading party's colour, follows the rating.
- Issue forms list the new milestone, M7 (post-release changes), instead of M6, and the roadmap adds it.

### Fixed

- `npm run lint` reported two `react(refs)` warnings in the House maps: the zoom hook returned the map's ref inside the object the maps read during render. The maps now take the ref out of it, and the lint runs clean.
- In CA-11 and CA-14, two Democrats running for an open seat, one was labelled "Open seat" and the other "Challenger". The exporter now labels both "Open seat" when a same-party race has no incumbent running.

## [1.0.0] - 2026-10-31

First release: the 2026 House and Senate forecast, explored with a national-environment slider, in English and Spanish.

### Added

- Repository setup: Vite + React + TypeScript (strict) app with Vitest and oxlint, CI and GitHub Pages workflows, Dependabot, Issue forms, PR template, security policy and the project specification (`docs/SPEC.md`).
- Data exporter (`scripts/export_data.py`): reads the forecast workbook, runs the self-checks in SPEC §2.6 (race counts, ratings, flips, seat totals, rating counts, Montana's shares, sheet reference) and writes `public/races.json` with every House and Senate race, its type, candidates, incumbency, baseline margin and 2024 context. Unit tests for its helpers run in CI.
- Forecast model, first part (`src/model/`): margins and winners under the slider (normal, blend, fixed and Montana's three-way race, with the ±90 cap), ratings, rating counts and seat totals, with unit tests and the SPEC §5 acceptance tests against `races.json`.
- Correlated Monte Carlo (`src/model/simulate.ts`): 10,000 simulations with a shared national error and per-race errors, drawn once from a seeded generator, giving per-race win probabilities, each party's median seats, 80% interval and seat histogram, and the chance of control. Tests check that every race's probability moves with the slider; `npm run bench` times it locally.
- English and Spanish UI strings (`src/i18n/`): a lookup with an English fallback, and locale-aware margins ("D+8.75" / "D+8,75", "EVEN" / "Empate") and win probabilities (">99%", "<1%"). A test keeps both catalogs' keys and placeholders in step.
- Header and slider: the title, a House/Senate switch and an EN/ES toggle; the national-environment slider from D+29 to R+20 in 0.01-point steps, with its value (coloured along the track's gradient), a marker at the default (D+8.70) and a reset button. The arrow keys move it by 0.1 points and Shift+arrow by 1 point. Light and dark themes, and a layout that works on a phone.
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
- Race search above the map: find a race by district code ("CA-22", "TX 7", "AK 1"), state and district in either language ("Nueva York 17"), state or candidate name, without minding case or accents. Up to 8 suggestions in an accessible combobox (arrow keys, Enter, Escape). Picking one selects the race and, on the House maps, zooms the map to it.
- Seat histogram under the map: how many seats R wins across the 10,000 simulations at the slider's environment, red where R has control and blue elsewhere, with the line where control starts (218, or 50 in the Senate) and a tooltip per bar; a table gives each party's median and 80% interval in the simulations. Drawn as SVG, with no new dependency.
- Key races under the map: the flips at the slider, by the party that loses them; the 10 closest races (fixed races left out); and the tipping-point race, the one that gives control with the races sorted by margin (in the Senate, counting the seats not up). Each race is a button that selects it: on wide screens the race panel stays in view beside the lists, on narrow ones the page scrolls up to it, and a zoomed-in House map moves to the race. Each flip column shows 10 races and a "Show all" button.
- `races.json` carries the workbook's own ratings and totals (`workbookRating`, `workbook`), so the acceptance tests compare the TypeScript model with the workbook.
- A footer with the author and the licenses ("© 2026 Enzo Agustín Aguirre Polenta · Code: Apache 2.0 · Forecast: CC BY 4.0 · GitHub"), in both languages.

### Changed

- License: the code and docs move from MIT to the Apache License 2.0, with a `NOTICE` naming the author that redistributions and derivative works must keep; the forecast in `public/races.json` is under CC BY 4.0 (`LICENSE-DATA`), so reusing it requires crediting the author. The README explains both and the terms of the third-party map data.
- The forecast is updated to the workbook of 31 October 2026, still at the D+9.0 baseline. In the Senate, Kansas moves from Tilt R to Tilt D (the workbook's total is now 53 D / 47 R), and Arkansas, Illinois and South Dakota move by 2 to 7 points; more races have polls (24 of 35, was 19). Nebraska's background shows the 2024 regular election against Osborn (R+6.7) instead of the special for its seat. The House moves by less than a hundredth of a point, except ME-01 and ME-02 (0.8 toward D). The test that fixed the number of polled Senate races now checks that every poll source is a known one.
- The page's default and recommended environment is D+8.70 (was D+8.75). There Kansas is R+0.06, so the Senate opens at 52 D / 48 R with a 31% chance of R control; the House opens at 235 D / 200 R, as before.
- The simulation's error sigmas are calibrated (SPEC §3.3): national 2.5 points (was 3.0), House races 5.5 (was 5.0), Senate races 4.5 with polls and 6.5 with few polls or none (was 4.5 for all). At D+8.75 the chance of an R House majority drops from about 2% to under 1%, and of R Senate control from 34% to 31%.
- Issue forms list only the open milestone (M6), and the roadmap marks M2, M3, M4 and M5 as done.
- On a touch screen, a tap on the summary bar or the histogram keeps its tooltip open until a touch anywhere else (the histogram's used to vanish when the finger lifted). Dragging across the histogram still moves it from bar to bar.
- The spec records the measured simulation times: in Node, the House takes about 10 ms per slider move (worst 15 ms) and the Senate under 2 ms; in Chrome with the production build, about 15 ms from the slider to the updated page.
- Specification: the page opens at D+8.75 (`DEFAULT_ENV`), separate from the workbook baseline; the slider runs from D+29 to R+20 in 0.01-point steps; candidate labels keep only the incumbency status; independents can run in the REP slot; Montana's third candidate is named; each race carries its 2024 presidential margin and its last election as context. Also documents workbook details the exporter must handle.
- The Senate map's description, hover, selection, tooltip and legend moved to `useRaceMap` and `MapParts`, shared with the House maps.
- Real district shapes are in scope: the spec and `CLAUDE.md` describe the district map, its source and how to rebuild it.
- Fixed races (uncontested and same-party) no longer show a margin of ±100 in the map's tooltip.
- The spec lists the supported browsers: Chrome and Edge 123+, Firefox 128+, Safari 18+.

### Fixed

- On a phone, a finger that landed on the slider's track to scroll the page also moved the national environment to it. The slider now puts the value back when the gesture turns into a scroll.
- On a 320 px screen the Senate's three seat totals (in Spanish) were 4 px wider than the page; they now fit.
- In the dark theme, the race panel's party letters ("R", "D") had a 3.8:1 and 4.1:1 contrast on the panel's background; they are now lighter there and reach 4.5:1.
- On the deployed site, the light theme showed the dark theme's text colours when the system preferred dark (and the reverse). The production build replaced `light-dark()` with a fallback that follows only the system theme; the CSS build target now keeps `light-dark()` as written.

[Unreleased]: https://github.com/EGCGAP04/midterms-2026-simulator/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/EGCGAP04/midterms-2026-simulator/releases/tag/v1.0.0
