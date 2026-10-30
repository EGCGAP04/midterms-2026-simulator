# Security policy

## Supported versions

Only the `main` branch and the site deployed from it are maintained.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting instead: the [Security](https://github.com/EGCGAP04/midterms-2026-simulator/security) tab → *Report a vulnerability*.

If you can, include:

- What is affected (the web app, the data exporter or a workflow).
- How to reproduce it and what impact it has.

## Scope

The app is a static site with no backend, no accounts and no stored user data. Its only input from the user is the URL query string (`?ch=…&env=…&lang=…`). Reports about, for example, script injection through the query string, or a workflow that could be abused to publish a modified site, are welcome.

The forecast itself (ratings, margins, probabilities) is a model, not a security matter: report disagreements with it as a regular issue.
