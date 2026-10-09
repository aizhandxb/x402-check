# Design: add-x402-check-mvp

## 2. Structure

Two deliverables, each with its own implementation plan.

| Part | Where | Contents |
|---|---|---|
| **`x402-check` repo** | `~/vscode/public/x402-check`, public on GitHub under the `aizhandxb` account, Apache-2.0, built with OpenSpec + TDD | `src/core` (pure checks), `src/cli` (CLI), `worker/` (Cloudflare Worker API) |
| **ledgers.ae page** | this monorepo, `sites/ledgers.ae/` | `/tools/x402-checker/` page plus JS that calls the Worker; `/tools/` switches from "coming soon" to "live" |

npm package name: `x402-check` (confirmed unregistered on 2026-10-09).

### 2.1 Core interface

```ts
type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Finding {
  id: string;          // "X01".."X08"
  severity: Severity;
  title: string;       // one line, plain language
  evidence: string;    // what we saw (status, header value, excerpt)
  fix: string;         // what to change
  docs: string;        // link, default https://ledgers.ae/security/
}

interface CheckReport {
  url: string;
  checkedAt: string;   // ISO 8601
  specVersion: 1 | 2 | null;
  findings: Finding[]; // includes passes as severity "info" with title "OK: ..."
  requestsMade: number;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function checkEndpoint(url: string, opts: { fetch: Fetcher; method?: "GET" | "POST"; timeoutMs?: number }): Promise<CheckReport>;
```

The core does no network I/O of its own. It receives `fetch`, so tests can use recorded responses, and the Worker can wrap the real `fetch` with its safety guards (section 4).

### 2.2 CLI

- `npx x402-check <url> [--method POST] [--json] [--timeout 10000]`
- Human output: findings grouped by severity, with each fix shown.
- `--json` prints the `CheckReport` as JSON.
- Exit code: `0` if there are no high or critical findings, `1` if there are, `2` on usage or network error. That makes it CI-ready, and the GitHub Action can be added later.

### 2.3 Worker API

- `POST /check` with body `{ url, method?, turnstileToken }` returns a `CheckReport`, or `{ error }` with a 4xx code.
- CORS allows only `https://ledgers.ae`.
- Deployed as a `workers.dev` Worker on the owner's Cloudflare account; a custom route can be added later.

## 3. Checks (passive only)

None of these checks sends a signed payment. At most 3 requests per run:
1. an unpaid request (`Accept: application/json` and a non-browser User-Agent, because the reference server shows browsers an HTML paywall);
2. at most one same-host redirect;
3. the same request with a junk payment header.

Cache indicators for X05 are read from the response to the first request.

| ID | Check | Fails when | Severity |
|---|---|---|---|
| X01 | Payment gate | An unpaid request does not return 402 (200 means the content is ungated) | critical (200), medium (other non-402) |
| X02 | Spec version | The endpoint uses v1 (a JSON body with `x402Version: 1`, client header `X-PAYMENT`) instead of v2 (base64 JSON in a `PAYMENT-REQUIRED` header, client header `PAYMENT-SIGNATURE`) | medium |
| X03 | Payment requirements | The `PAYMENT-REQUIRED` header can't be decoded; there's no `accepts` list; a required field is missing (v2: `resource.url`, and per option `scheme`, `network`, `amount`, `asset`, `payTo`, `maxTimeoutSeconds`; v1: `maxAmountRequired` instead of `amount`); the network is not CAIP-2 in v2; `payTo` doesn't match an `eip155` or `solana` address format; the amount is not a positive integer string | high (medium for an unrecognized scheme, a bad `maxTimeoutSeconds`, or `resource.url` not matching the checked URL) |
| X04 | Junk payment rejected | A malformed `PAYMENT-SIGNATURE` (or `X-PAYMENT` on v1) gets a 2xx response. 400 (the spec) and 402 (the reference server) both pass | critical |
| X05 | Cache safety | The paid path shows CDN cache indicators (`Age` > 0, `cf-cache-status: HIT`, `x-cache: HIT`), or the response lacks `Cache-Control: no-store` or `private` | high (cache hit without no-store), medium (cache hit despite no-store), low (no-store missing) |
| X06 | Transport | Plain HTTP, or a redirect to another host | high |
| X07 | Browser CORS (recommendation; the x402 spec does not cover CORS) | CORS is enabled but `Access-Control-Expose-Headers` does not list `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE` (v2 only) | low |
| X08 | Discovery | `extensions.bazaar` is present or absent in the v2 PaymentRequired object | info |

**Wire formats (verified 2026-10-09 against github.com/x402-foundation/x402 main, pushed 2026-10-07):** `specs/x402-specification-v2.md`, `specs/transports-v2/http.md`, `specs/x402-specification-v1.md`, `specs/extensions/bazaar.md`, and the reference server `typescript/packages/core/src/http/x402HTTPResourceServer.ts`. Test fixtures copy the spec's own examples and cite these paths.

## 4. Safety (hosted Worker)

The Worker requests user-supplied URLs, so it must not become an open proxy or a way to probe private networks.

- **Scheme:** only `https:` URLs are accepted. Plain `http:` is reported as an X06 finding, but the request itself is refused.
- **Private-network blocking (SSRF):** resolve the hostname with DNS-over-HTTPS before fetching. Reject loopback, private ranges, link-local and cloud-metadata addresses (169.254.169.254, fd00::/8 and similar), plus `localhost` and `*.internal`. Also reject IP-literal hosts in those ranges.
- **Redirects:** `redirect: "manual"`. A redirect to a different host is reported as X06 and not followed. Same-host redirects are followed at most once.
- **Limits:** at most 3 outbound requests per check, a 10-second total timeout, and a 256 KB response body cap (read as a stream, then aborted).
- **Abuse controls:** a Turnstile token is required. The Worker reuses the existing Group AE Turnstile widget if its hostnames include `ledgers.ae`; otherwise it gets a new widget, which needs the owner to add the secret. Requests are rate-limited per client IP with Cloudflare's rate-limiting binding: 10 checks per minute and 100 per day.
- **Privacy:** checked URLs and results are not stored. Logs hold only aggregate counts and the hostname. The page says this.
- **Outbound identification:** a `User-Agent` of `x402-check/<version> (+https://ledgers.ae/tools/x402-checker/)`, so endpoint owners can see who is calling.

The CLI runs on the user's own machine, so it applies only the limits and the redirect rule. It does not apply private-network blocking, because developers should be able to check `localhost` while they build.

