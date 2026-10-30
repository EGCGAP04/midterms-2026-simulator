# midterms-2026-simulator

**Midterms 2026 Simulator**: explore a 2026 US House and Senate forecast. Move the national environment (the generic congressional ballot) and watch every race, the rating counts, the seat totals and the win probabilities update live. The UI is in English and Spanish.

> Status: in development. See the roadmap in [`CLAUDE.md`](CLAUDE.md) and the [milestones](https://github.com/EGCGAP04/midterms-2026-simulator/milestones). The full specification is in [`docs/SPEC.md`](docs/SPEC.md).

It is a static site with no backend: a Python exporter turns the forecast workbook into `public/races.json`, and a React + D3 app runs the model and a correlated Monte Carlo simulation in the browser.

## Requirements

- Node.js, the version in [`.nvmrc`](.nvmrc). With [nvm](https://github.com/nvm-sh/nvm): `nvm install && nvm use`.
- Python 3, for the data exporter (from M1).

## Development

```bash
npm ci
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run build      # type-check and production build into dist/
npm run preview    # serve dist/ locally
```

## Data

The forecast lives in an Excel workbook that is **not** part of the repository; only the generated `public/races.json` is versioned. The exporter and the instructions to regenerate the data arrive in M1 ([#2](https://github.com/EGCGAP04/midterms-2026-simulator/issues/2)).

## Deploy

Every push to `main` builds the site and deploys it to GitHub Pages: <https://egcgap04.github.io/midterms-2026-simulator/>. The workflow is in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and can also be run by hand from the Actions tab.

## Project structure

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/          # Issue forms: feature, bug, chore, docs, refactor
│   ├── workflows/
│   │   ├── ci.yml               # Build and test (required check)
│   │   └── deploy.yml           # GitHub Pages
│   ├── dependabot.yml
│   └── pull_request_template.md
├── docs/
│   └── SPEC.md                  # Specification: data, model and UI
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .editorconfig
├── .gitattributes
├── .gitignore
├── .nvmrc
├── .oxlintrc.json
├── CHANGELOG.md
├── CLAUDE.md                    # Working guide and roadmap
├── LICENSE
├── README.md
├── SECURITY.md
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

## License

[MIT](LICENSE)
