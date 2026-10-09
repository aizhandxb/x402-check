# x402-check

Passive security and setup checks for **x402 payment endpoints**. Point it at a paid URL and it tells you, in plain language, what to fix before agents start paying it.

It never signs or sends a real payment, and it makes at most 3 HTTP requests per run.

```bash
npx x402-check https://api.example.com/premium-data
```

Prefer a browser? Use the hosted version at https://ledgers.ae/tools/x402-checker/

## What it checks

| ID | Check | Why it matters |
|---|---|---|
| X01 | Unpaid requests get HTTP 402 | Otherwise your content is free |
| X02 | x402 v2 (`PAYMENT-REQUIRED`) vs v1 | v2 is the current spec |
| X03 | Payment requirements are complete and valid | A wrong `payTo` or network means payments go nowhere |
| X04 | A junk payment header is rejected | Some servers only check that the header exists |
| X05 | Paid responses can't be cached by a CDN | A cached paid response is served to everyone |
| X06 | HTTPS and no cross-host redirect | Payment headers must not leak |
| X07 | CORS exposes payment headers (recommendation) | Browser agents can't read hidden headers |
| X08 | Discovery (Bazaar) metadata | Helps agents find your endpoint |

Details and fixes for each check: [docs/checks.md](docs/checks.md). The checks map to the attack classes in *Five Attacks on x402 Agentic Payment Protocol* (arXiv 2605.11781), explained in the [agentic payment security guide](https://ledgers.ae/security/).

## Usage

```bash
npx x402-check <url> [--method GET|POST] [--json] [--timeout 10000]
```

Exit codes: `0` no high or critical findings, `1` high or critical findings, `2` usage or network error. That makes it easy to run in CI:

```yaml
- run: npx x402-check https://staging.example.com/paid --json > x402-report.json
```

As a library:

```ts
import { checkEndpoint } from "x402-check";
const report = await checkEndpoint("https://api.example.com/premium-data", { fetch });
```

## What it does not check

Passive checks can't prove that replay protection, settlement ordering or settlement preemption are handled correctly. Testing those means sending real (testnet) payments, retrying them and racing them, which is only safe on endpoints you own. We do that inside the [Agentic Payment Security Audit](https://ledgers.ae/services/agentic-payment-security-audit/).

## Privacy

The CLI talks only to the URL you give it. The hosted version does not store the URLs you check or the reports. It logs only the hostname and the most severe result, for abuse prevention and usage counts.

Terminal output escapes control characters, so a hostile endpoint cannot inject escape sequences into your terminal.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes go through an OpenSpec proposal in `openspec/changes/` and are developed test-first.

## License

Apache-2.0
