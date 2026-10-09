# Contributing to x402-check

Thanks for considering a contribution. x402-check is developed spec-first and test-first; this file tells you everything needed to get a change merged.

## Development setup

```bash
git clone https://github.com/aizhandxb/x402-check.git
cd x402-check
npm install             # installs dev dependencies
npm test                # unit tests (no network)
npm run typecheck       # types (strict)
npm run worker:build    # wrangler dry-run build of the hosted Worker
```

Node 20 or newer is required.

## How changes work here

1. **Spec first.** Behavior changes go through [OpenSpec](https://github.com/Fission-AI/OpenSpec): propose a change under `openspec/changes/<change-id>/` (proposal, spec deltas, tasks) before implementation, using `npx @fission-ai/openspec`. Small fixes that do not change specified behavior can go straight to a PR.
2. **Tests first.** Every implementation task starts with a failing test. PRs that add behavior without tests will be asked to add them.
3. **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

## Ground rules

- The checker stays passive: it never signs or sends a real payment, and makes at most 3 requests per run.
- No telemetry, ever. No network calls beyond the URL the user asks to check.
- Keep dependencies lean; adding one is a design decision, not a convenience.
- No em dashes or en dashes in code, docs or commit messages. Use a short hyphen.

## Reporting issues

Use [GitHub issues](https://github.com/aizhandxb/x402-check/issues). For a wrong or missing finding, include the checked URL if it is public, or the response status and headers if it is not.
