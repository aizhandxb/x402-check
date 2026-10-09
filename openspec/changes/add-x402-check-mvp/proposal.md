# Proposal: add-x402-check-mvp

## Why
x402 endpoints are easy to ship with setup and safety bugs: content served without payment, v1-only
headers, malformed payment requirements, junk payment headers accepted, and paid responses cached by a
CDN. A May 2026 study (arXiv 2605.11781) found 11 vulnerabilities across three SDKs and four live
endpoints. Teams need a fast, safe, free way to catch the passive subset of these issues.

## What Changes
- New library `checkEndpoint(url, { fetch })` returning a `CheckReport` of findings X01-X08.
- New CLI `x402-check <url> [--method POST] [--json] [--timeout ms]` with CI exit codes.
- New Cloudflare Worker `POST /check` with private-network guard, Turnstile, per-IP rate limit and an origin allowlist.

## Impact
- New capabilities: `endpoint-checks`, `cli`, `hosted-api`.
- No breaking changes (new project).
