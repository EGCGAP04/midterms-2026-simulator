# CLAUDE.md

Guide for Claude Code in this repository. Read it in full before proposing changes.

## What it is

**midterms-2026-simulator** (the app is titled *Midterms 2026 Simulator*): a static web app to explore a 2026 US House and Senate forecast. The user moves a national-environment slider (generic congressional ballot) and every race, rating count, seat total and win probability updates live. The UI is bilingual (English / Spanish).

- `docs/SPEC.md`: the specification. **It is the source of truth** for the data layout, the `races.json` schema, the model and the UI.
- `scripts/export_data.py`: reads the forecast workbook and writes `public/races.json`, failing if any self-check does not hold. Its pure helpers are tested in `scripts/test_export_data.py` (stdlib `unittest`, no openpyxl needed).
- `src/model/`: pure model functions (margins, ratings, Monte Carlo) with Vitest tests (M2).
- `src/components/`, `src/i18n/`: the UI (M3–M5).

Out of scope unless asked: a backend, other election years, editing the forecast in the app.

## How we work

- Claude Code writes the code. Enzo reviews it and makes small changes by hand.
- **Re-read a file before editing it**: it may have manual changes. Respect them; if one looks wrong, say so instead of overwriting it.
- Before large changes (a new module, or more than ~3 files), show a short plan and wait for the OK.
- Work in small, reviewable steps. After each step, run the lint, tests and build.
- When done, summarize what changed and briefly explain any non-obvious decision, so the review is easy.
- Claude Code may commit, push and open PRs on its own (Enzo allowed it on 2026-10-30). **Merging** still needs Enzo's explicit request for that PR. Commits use Conventional Commits.
- Do not add dependencies without asking. Approved: the stack in `docs/SPEC.md` §1 (Vite, React, TypeScript, D3 modules `d3-geo`/`d3-scale`/`d3-shape`/`d3-zoom`/`d3-selection`, `topojson-client`, `us-atlas`, Vitest, `openpyxl`) plus what the Vite template brings (`@vitejs/plugin-react`, `oxlint`, `@types/node`). Their `@types/*` packages count as approved too.
- **Any change to the data format or the model goes into `docs/SPEC.md` first**, then into the code.

## Git and GitHub

- Repo: `github.com/EGCGAP04/midterms-2026-simulator` (public, MIT). Use `gh` for everything GitHub, and check state with `gh` rather than trusting local branches. If `gh` has more than one account logged in, the active one must be `EGCGAP04` (`gh auth switch`).
- `main` is protected by a ruleset: **no direct pushes**, no force-push, no deletion. Everything goes in through a PR (no approvals required). The `Build and test` check must pass.
- **Signed commits on every branch.** Signing is set up in Enzo's `~/.gitconfig` (SSH, `commit.gpgsign true`). Never use `--no-gpg-sign`.
- **Attribution:** commits Claude Code prepares end with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`, and PR bodies with the *Generated with Claude Code* line, as in Enzo's other repositories.
- **CI** (`.github/workflows/ci.yml`): the `Build and test` job runs `npm ci`, `npm run build` (which type-checks), `npm test` and `npm run lint` on every PR and on `main`. It is a required check: if the job's `name:` changes, update the ruleset.
- **Deploy** (`.github/workflows/deploy.yml`): every push to `main` builds the site with the Pages base path (`/midterms-2026-simulator/`) and deploys it to GitHub Pages. It can also be run by hand (`workflow_dispatch`).
- **CodeQL**: GitHub's default setup (JavaScript/TypeScript, Python and Actions). Not a required check.
- Actions in workflows are pinned by full SHA with the version in a comment (`@<sha> # v7.0.1`). Only GitHub-owned actions (`actions/*`, `github/*`) are allowed in the repo settings: using another one is a decision, not a line of YAML.
- Dependabot opens weekly grouped PRs (`build(deps): ...` for npm, `ci(deps): ...` for actions, label `dependencies`). Enzo reviews and merges them; do not touch them unless asked. Dependabot never updates `CHANGELOG.md`: fold its bumps into the next PR's entry.
- Flow: branch from an up-to-date `main` → commits → `git push -u origin <branch>` → `gh pr create` → squash merge. The remote branch is deleted on merge; then `git switch main && git pull` and delete the local branch (`-D` may be needed after a squash merge).
- Branch names: `<type>/<issue-number>-<short-description>`, e.g. `feat/3-export-data` or `fix/12-tooltip-overflow`. No number if there is no Issue.
- Only **squash merge** is enabled: the **PR title** becomes the commit message on `main`, so it must follow Conventional Commits. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, `chore`. Scopes: `data` (exporter and `races.json`), `model`, `ui`, `i18n`. E.g. `feat(model): add correlated Monte Carlo simulation`.
- **PR bodies follow `.github/pull_request_template.md`.** Tick the checklist honestly: a box stays empty if the thing was not done, with a line in *Additional notes* saying why. Decisions beyond the Issue go in *Additional notes* with the reason.
- **Every PR updates `CHANGELOG.md`** under `[Unreleased]` (Keep a Changelog, Semantic Versioning).
- **Every PR that adds, removes or renames a file updates the README's *Project structure* tree.** Check it against `git ls-files` (plus `git ls-files --others --exclude-standard` before committing), not by eye.
- **Issues** use the forms in `.github/ISSUE_TEMPLATE/` (Feature, Bug, Chore, Docs, Refactor; blank issues are disabled). An Issue created with `gh issue create --body-file` skips the form, so mirror its sections by hand. The milestone dropdown in every form lists the open milestones: update all five forms when a milestone is created or closed.
- **Every Issue and PR is assigned to Enzo (`EGCGAP04`) and carries labels and a milestone.** A PR carries the same labels and milestone as its Issue, and `Closes #N` in its body:
  ```bash
  gh pr create --assignee @me --label feature --label ui --milestone "M3: Core UI" --body-file <file>
  ```
- Labels: type (`feature`, `bug`, `chore`, `documentation`, `refactor`, `dependencies`) and area (`data`, `model`, `ui`).
- Milestones: one per roadmap stage (see below). Enzo closes them.
- Project: [midterms-2026-simulator](https://github.com/users/EGCGAP04/projects/6) (number 6, owner `EGCGAP04`, public, linked to the repo). Every Issue and PR goes on it. When starting something, move it to `In Progress`; closing an Issue or merging a PR moves it to `Done`.
  ```bash
  gh project item-add 6 --owner EGCGAP04 --url <issue or PR url>
  gh project item-edit 6 --owner EGCGAP04 --url <issue or PR url> --field Status --value "In Progress"
  ```
  The board's *Auto-add to project* workflow adds new Issues and PRs from this repo by itself (in `Todo`), so check with `gh project item-list` instead of adding them; use `item-add` only if one is missing. The API is eventually consistent: an item can take a few seconds to show up.
- **Merge**: only when Enzo asks for that PR explicitly. Check first that it is `MERGEABLE` and the checks pass, then `gh pr merge <N> --squash --match-head-commit <full SHA>`.

## Environment

- PC: Linux Mint (Ubuntu base). **Node comes from nvm**, not from apt (apt's Node 18 is too old for Vite). The version is in `.nvmrc`: run `nvm use` in the repo. In a non-interactive shell, load nvm first with `. ~/.nvm/nvm.sh;` and a `;`, not `&&`: sourcing it returns exit code 3 when no default Node is set, which silently cuts an `&&` chain. If `node --version` still shows v18 right after switching, run `hash -r` (bash cached `/usr/bin/node`).
- `mapshaper` 0.6.102 is installed globally (`npm i -g mapshaper@0.6.102`), not as a project dependency: only `scripts/build_districts_map.sh` uses it, never CI.
- Python 3 with a local `.venv` for the exporter (ignored by Git): `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`. The system Python has no openpyxl.
- **The workbook `2026_US_Elections.xlsx` lives in the repo root but is never committed**: it is excluded through `.git/info/exclude` (local only), not `.gitignore`. Only the generated `public/races.json` is versioned. CI never sees the workbook, so it cannot regenerate the data.
- Sheet names change with each forecast update (`29-10 Senate`, `Senate House`, ...): they are exporter arguments, never hard-coded.
- Temporary files, drafts and analyses go in `~/Documents/Claude/midterms-2026-simulator/`, never inside the repo.

## Commands

```bash
nvm use                 # Node version from .nvmrc
npm ci
npm run dev             # local dev server
npm test                # Vitest
npm run bench           # time the simulation (local only, not in CI)
npm run house-hexes     # regenerate the House map's layout (when districts per state change)
npm run districts-map   # rebuild public/us-house-districts-2026.json from the Census files (needs mapshaper)
npm run lint            # oxlint
npm run build           # type-check (tsc -b) and production build into dist/
npm run preview         # serve dist/ locally
python3 -m unittest discover -s scripts   # exporter unit tests (also in CI)
.venv/bin/python scripts/export_data.py 2026_US_Elections.xlsx \
  --house-sheet "Senate House" --senate-sheet "29-10 Senate" --out public/races.json
```

## Conventions

- Everything in the repository is in **English**: code, comments, commits, Issues, PRs and docs. The UI strings exist in English and Spanish (`src/i18n/`).
- TypeScript in strict mode (`"strict": true` is explicit in both `tsconfig.*.json`, though TypeScript 6+ defaults to it). No `any` and no non-null assertions (`!`) unless justified in a comment.
- The model in `src/model/` is pure (no React, no DOM, no I/O) and fully unit-tested. Components only render and translate events.
- Margins are always **R − opposition** as fractions (−0.09 = D+9.0). Convert to points only for display.
- The model takes **Δ = env − g0** (`deltaFrom`), never the slider value itself: `g0` is the workbook baseline, `DEFAULT_ENV` only the page's starting point.
- Acceptance tests read their expected values from `races.json` (`workbookRating`, `workbook`), never from numbers written into the test, so a forecast update does not break them.
- Numbers are formatted with `Intl.NumberFormat` for the current locale, never by hand.

## Roadmap

- [x] M0: Repository setup (Vite + React + TS, CI, Pages, Issue forms, CHANGELOG).
- [x] M1: Data exporter: `scripts/export_data.py` with every self-check in SPEC §2.6, and `public/races.json`.
- [x] M2: Forecast model: margins, ratings and the correlated Monte Carlo, with the acceptance tests in SPEC §5.
- [x] M3: Core UI: header, slider, summary bar, i18n (EN/ES) and URL state.
- [x] M4: Maps: Senate state map, House district map and hex cartogram, zoom and pan.
- [ ] M5: Race details and lists: tooltip/side panel, seat histogram, flips, closest races and the tipping point.
- [ ] M6: Polish and launch: responsive layout, the < 50 ms performance budget, first release.

When a stage is done, tick it here (in the stage's last PR) and update the README if usage changed.
