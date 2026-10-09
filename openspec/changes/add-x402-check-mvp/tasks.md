# Tasks: add-x402-check-mvp

## 1. Foundation
- [x] 1.1 Scaffold package, TypeScript, Vitest, license, OpenSpec change
- [x] 1.2 Write failing tests for wire decoding and v1/v2 detection, then implement `src/wire.ts`
- [x] 1.3 Write failing tests for capped body reads, then implement `src/http.ts`

## 2. Checks
- [x] 2.1 Write failing tests for X01, X02 and X06, then implement
- [x] 2.2 Write failing tests for X03 (v1 and v2 requirements), then implement
- [x] 2.3 Write failing tests for X04 and X05, then implement
- [x] 2.4 Write failing tests for X07 and X08, then implement
- [x] 2.5 Write failing tests for `checkEndpoint` (redirects, junk probe, budget, timeout, ordering), then implement

## 3. CLI
- [x] 3.1 Write failing tests for argument parsing, output and exit codes, then implement

## 4. Hosted API
- [x] 4.1 Write failing tests for the private-network guard and DoH resolver, then implement
- [x] 4.2 Write failing tests for the handler (origin, rate limit, Turnstile, errors, logging), then implement; wrangler dry-run build

## 5. Release
- [x] 5.1 README, docs/checks.md, CONTRIBUTING, CODE_OF_CONDUCT, CI workflow
- [ ] 5.2 Owner-approved: GitHub repo, npm publish, Worker deploy, archive this change
