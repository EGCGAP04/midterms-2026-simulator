# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository setup: Vite + React + TypeScript (strict) app with Vitest and oxlint, CI and GitHub Pages workflows, Dependabot, Issue forms, PR template, security policy and the project specification (`docs/SPEC.md`).
- Data exporter (`scripts/export_data.py`): reads the forecast workbook, runs the self-checks in SPEC §2.6 (race counts, ratings, flips, seat totals, rating counts, Montana's shares, sheet reference) and writes `public/races.json` with every House and Senate race, its type, candidates, incumbency, baseline margin and 2024 context. Unit tests for its helpers run in CI.
- Forecast model, first part (`src/model/`): margins and winners under the slider (normal, blend, fixed and Montana's three-way race, with the ±90 cap), ratings, rating counts and seat totals, with unit tests and the SPEC §5 acceptance tests against `races.json`.
- Correlated Monte Carlo (`src/model/simulate.ts`): 10,000 simulations with a shared national error and per-race errors, drawn once from a seeded generator, giving per-race win probabilities, each party's median seats, 80% interval and seat histogram, and the chance of control. Tests check that every race's probability moves with the slider; `npm run bench` times it locally.
- `races.json` carries the workbook's own ratings and totals (`workbookRating`, `workbook`), so the acceptance tests compare the TypeScript model with the workbook.

### Changed

- Issue forms list only the open milestones (M3–M6), and the roadmap marks M2 as done.

- Specification: the page opens at D+8.75 (`DEFAULT_ENV`), separate from the workbook baseline; the slider moves in 0.01-point steps; candidate labels keep only the incumbency status; independents can run in the REP slot; Montana's third candidate is named; each race carries its 2024 presidential margin and its last election as context. Also documents workbook details the exporter must handle.

[Unreleased]: https://github.com/EGCGAP04/midterms-2026-simulator/commits/main
